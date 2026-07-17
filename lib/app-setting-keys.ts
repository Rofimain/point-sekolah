export const APP_KEYS = {
  REDAKSI_PRINT: "redaksi_print",
  SP1_POINTS: "sp1_points",
  SP2_POINTS: "sp2_points",
  SP3_POINTS: "sp3_points",
  SKORSING_POINTS: "skorsing_points",
} as const;

export type AppSettingKey = (typeof APP_KEYS)[keyof typeof APP_KEYS];
