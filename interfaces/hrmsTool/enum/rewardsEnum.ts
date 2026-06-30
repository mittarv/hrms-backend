/**
 * Rewards & Recognition enums
 */

export enum RewardCyclePhase {
  PENDING = "pending",
  NOMINATION = "nomination",
  VOTING = "voting",
  WINNERS = "winners",
}

export enum RewardCycleStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
}

export enum PhaseAuditPhaseName {
  NOMINATION = "nomination",
  VOTING = "voting",
  WINNERS = "winners",
}

export enum PhaseAuditAction {
  STARTED = "started",
  ENDED = "ended",
}

export enum AwardType {
  EMPLOYEE_CHOICE = "employee_choice",
  LEADERSHIP_CHOICE = "leadership_choice",
}

export const REWARDS_TOOL_NAME = "Rewards & Recognition";
