"""
Setup verification script.
Checks that all dependencies and configurations are correct.
"""

import sys
import importlib


def check_dependencies():
    """Check that all required dependencies are installed."""
    dependencies = [
        ('httpx', 'httpx'),
        ('redis', 'redis'),
        ('psycopg2', 'psycopg2-binary'),
        ('selectolax', 'selectolax'),
        ('tldextract', 'tldextract'),
        ('dotenv', 'python-dotenv'),
        ('anthropic', 'anthropic'),
        ('pydantic', 'pydantic'),
    ]

    print("Checking dependencies...")
    print("-" * 60)

    all_ok = True
    for module_name, package_name in dependencies:
        try:
            module = importlib.import_module(module_name)
            version = getattr(module, '__version__', 'unknown')
            print(f"✓ {package_name:25} {version}")
        except ImportError:
            print(f"✗ {package_name:25} NOT INSTALLED")
            all_ok = False

    print("-" * 60)
    return all_ok


def check_config():
    """Check configuration."""
    print("\nChecking configuration...")
    print("-" * 60)

    try:
        from config import Config

        # Check required settings
        checks = [
            ('DATABASE_URL', Config.DATABASE_URL),
            ('REDIS_URL', Config.REDIS_URL),
        ]

        all_ok = True
        for name, value in checks:
            if value:
                # Mask credentials
                masked = value[:20] + '...' if len(value) > 20 else value
                print(f"✓ {name:20} {masked}")
            else:
                print(f"✗ {name:20} NOT SET")
                all_ok = False

        # Optional settings
        optional_checks = [
            ('ANTHROPIC_API_KEY', Config.ANTHROPIC_API_KEY),
        ]

        for name, value in optional_checks:
            if value:
                masked = value[:10] + '...' if len(value) > 10 else value
                print(f"  {name:20} {masked} (optional)")
            else:
                print(f"  {name:20} not set (optional)")

        print("-" * 60)
        return all_ok

    except Exception as e:
        print(f"✗ Configuration error: {e}")
        print("-" * 60)
        return False


def check_services():
    """Check that required services are accessible."""
    print("\nChecking services...")
    print("-" * 60)

    all_ok = True

    # Check Redis
    try:
        import redis
        from config import Config

        r = redis.from_url(Config.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        print(f"✓ Redis connection    OK ({Config.REDIS_URL})")
    except Exception as e:
        print(f"✗ Redis connection    FAILED: {e}")
        all_ok = False

    # Check PostgreSQL
    try:
        import psycopg2
        from config import Config

        conn = psycopg2.connect(Config.DATABASE_URL, connect_timeout=2)
        conn.close()
        print(f"✓ PostgreSQL          OK")
    except Exception as e:
        print(f"✗ PostgreSQL          FAILED: {e}")
        all_ok = False

    print("-" * 60)
    return all_ok


def check_modules():
    """Check that all worker modules can be imported."""
    print("\nChecking worker modules...")
    print("-" * 60)

    modules = [
        'config',
        'database',
        'queue_handler',
        'pipeline.normalizer',
        'pipeline.fetcher',
        'pipeline.discoverer',
        'pipeline.validator',
        'extractors.email',
        'extractors.phone',
        'extractors.person',
        'extractors.llm',
        'utils.patterns',
    ]

    all_ok = True
    for module_name in modules:
        try:
            importlib.import_module(module_name)
            print(f"✓ {module_name}")
        except Exception as e:
            print(f"✗ {module_name}: {e}")
            all_ok = False

    print("-" * 60)
    return all_ok


def main():
    """Run all checks."""
    print("\n" + "=" * 60)
    print("LEADTOOL WORKER - SETUP VERIFICATION")
    print("=" * 60 + "\n")

    results = []

    # Check dependencies
    results.append(('Dependencies', check_dependencies()))

    # Check configuration
    results.append(('Configuration', check_config()))

    # Check modules
    results.append(('Worker Modules', check_modules()))

    # Check services
    results.append(('Services', check_services()))

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    all_passed = True
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{name:20} {status}")
        if not passed:
            all_passed = False

    print("=" * 60)

    if all_passed:
        print("\n✓ All checks passed! Worker is ready to run.")
        print("\nStart the worker with:")
        print("  python main.py")
        print("\nTest extraction with:")
        print("  python test_extraction.py https://example.com")
        print()
        return 0
    else:
        print("\n✗ Some checks failed. Please fix the issues above.")
        print("\nCommon fixes:")
        print("  - Install dependencies: pip install -r requirements.txt")
        print("  - Configure environment: cp .env.example .env && edit .env")
        print("  - Start Redis: redis-server")
        print("  - Start PostgreSQL")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
