export const APP_KEYS = {
  COORD_NAME: "coord_name",
  COORD_TITLE: "coord_title",
  REDAKSI_PRINT: "redaksi_print",
  NEXT_REVIEW_VIOLATIONS: "next_review_violations",
  NEXT_REVIEW_ROSTER: "next_review_roster",
  SP1_POINTS: "sp1_points",
  SP2_POINTS: "sp2_points",
  SP3_POINTS: "sp3_points",
  SKORSING_POINTS: "skorsing_points",
} as const;

export type AppSettingKey = (typeof APP_KEYS)[keyof typeof APP_KEYS];
