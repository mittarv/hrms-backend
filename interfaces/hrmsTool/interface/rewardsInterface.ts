import {
  RewardCyclePhase,
  RewardCycleStatus,
  PhaseAuditPhaseName,
  PhaseAuditAction,
  AwardType,
} from "../enum/rewardsEnum";

export interface RewardCycleAttributes {
  id: string;
  month: number;
  year: number;
  currentPhase: RewardCyclePhase;
  status: RewardCycleStatus;
  nominationStartDate: Date | null;
  nominationEndDate: Date | null;
  votingStartDate: Date | null;
  votingEndDate: Date | null;
  winnersAnnouncedDate: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NominationAttributes {
  id: string;
  cycleId: string;
  nomineeEmpUuid: string;
  nominatedByEmpUuid: string;
  citation: string;
  isRemoved: boolean;
  removedByEmpUuid: string | null;
  removedAt: Date | null;
  removalReason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GroupedCitationAttributes {
  id: string;
  cycleId: string;
  nomineeEmpUuid: string;
  groupedCitation: string;
  createdByEmpUuid: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VoteAttributes {
  id: string;
  cycleId: string;
  nomineeEmpUuid: string;
  votedByEmpUuid: string;
  /** employee_choice = vote from non-leadership; leadership_choice = vote from leadership_key department */
  voteCategory?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WinnerAttributes {
  id: string;
  cycleId: string;
  employeeEmpUuid: string;
  awardType: AwardType;
  voteCount: number;
  finalCitation: string;
  announcedAt: Date;
  announcedByEmpUuid: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PhaseAuditLogAttributes {
  id: string;
  cycleId: string;
  phaseName: PhaseAuditPhaseName;
  action: PhaseAuditAction;
  triggeredByEmpUuid: string;
  createdAt?: Date;
}
