import { z } from "zod";

export const clientProfileSchema = z.object({
  mission: z.string().trim().min(1, "Enter the client's mission.").max(3000),
  goals: z.string().trim().min(1, "Enter the client's goals.").max(3000),
});
export type ClientProfile = z.infer<typeof clientProfileSchema>;
export const fitSchema = z.object({
  stars: z.number().int().min(1).max(5),
  rationale: z.string().min(1),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  requirementsToVerify: z.array(z.string()),
});
export type FitAssessment = z.infer<typeof fitSchema> & { profile: ClientProfile };