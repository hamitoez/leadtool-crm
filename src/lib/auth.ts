import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import prisma from "./prisma";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "./security/rate-limiter";
import { verifyTOTPCode, decryptTOTPSecret, verifyBackupCode } from "./security/totp";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
    error: "/auth/error",
  },
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),

    // GitHub OAuth Provider
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),

    // Credentials Provider (Email/Password)
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = (credentials.email as string).toLowerCase().trim();

        // Check rate limit before attempting login
        const rateLimitCheck = checkRateLimit(email);
        if (!rateLimitCheck.allowed) {
          throw new Error(
            `Too many login attempts. Please try again in ${rateLimitCheck.retryAfterSeconds} seconds.`
          );
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            backupCodes: {
              where: { usedAt: null },
            },
          },
        });

        if (!user || !user.password) {
          // Record failed attempt (user not found)
          recordFailedAttempt(email);
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          // Record failed attempt (wrong password)
          recordFailedAttempt(email);
          throw new Error("Invalid credentials");
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const totpCode = credentials.totpCode as string | undefined;

          if (!totpCode) {
            // Signal that 2FA is required
            throw new Error("2FA_REQUIRED:" + user.id);
          }

          // Try TOTP code first
          const secret = decryptTOTPSecret(user.twoFactorSecret);
          let isValidCode = verifyTOTPCode(secret, totpCode);

          // If TOTP fails, try backup codes
          if (!isValidCode && totpCode.length >= 8) {
            for (const backupCode of user.backupCodes) {
              const isValidBackup = await verifyBackupCode(totpCode, backupCode.code);
              if (isValidBackup) {
                // Mark backup code as used
                await prisma.twoFactorBackupCode.update({
                  where: { id: backupCode.id },
                  data: { usedAt: new Date() },
                });
                isValidCode = true;
                break;
              }
            }
          }

          if (!isValidCode) {
            recordFailedAttempt(email);
            throw new Error("Invalid 2FA code");
          }
        }

        // Successful login - clear rate limit
        clearRateLimit(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth logins, mark email as verified automatically
      if (account?.provider !== "credentials" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (existingUser && !existingUser.emailVerified) {
          await prisma.user.update({
            where: { email: user.email },
            data: { emailVerified: new Date() },
          });
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.provider = account?.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
