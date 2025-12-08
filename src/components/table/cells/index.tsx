"use client";

import { ColumnType } from "@prisma/client";
import { TextCell } from "./text-cell";
import { UrlCell } from "./url-cell";
import { EmailCell } from "./email-cell";
import { PhoneCell } from "./phone-cell";
import { StatusCell } from "./status-cell";
import { ConfidenceCell } from "./confidence-cell";
import { DateCell } from "./date-cell";
import { NumberCell } from "./number-cell";
import { SelectCell } from "./select-cell";
import { MultiSelectCell } from "./multi-select-cell";

export { TextCell, UrlCell, EmailCell, PhoneCell, StatusCell, ConfidenceCell, DateCell, NumberCell, SelectCell, MultiSelectCell };

export const getCellRenderer = (columnType: ColumnType) => {
  switch (columnType) {
    case "TEXT":
      return TextCell;
    case "URL":
      return UrlCell;
    case "EMAIL":
      return EmailCell;
    case "PHONE":
      return PhoneCell;
    case "STATUS":
      return StatusCell;
    case "CONFIDENCE":
      return ConfidenceCell;
    case "NUMBER":
      return NumberCell;
    case "DATE":
      return DateCell;
    case "SELECT":
      return SelectCell;
    case "MULTI_SELECT":
      return MultiSelectCell;
    case "PERSON":
      return TextCell;
    case "COMPANY":
      return TextCell;
    case "ADDRESS":
      return TextCell;
    case "AI_GENERATED":
      return TextCell;
    default:
      return TextCell;
  }
};
