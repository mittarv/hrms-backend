/**
 * Rewards & Recognition - HTTP controller
 */

import { Response } from "express";
import { AuthenticatedRequest } from "../../../middlewares/isAuthenticated";
import { AuthenticatedUser } from "../../../interfaces/hrmsTool/interface/hrmsInterface";
import { checkHrmsPermission } from "../../../utilities/hrmsUtilities/dbCalls/hrmsAccessServices";
import { createHRMSNotification } from "../../../utilities/hrmsUtilities/dbCalls";
import { hrmsNotificationTypes } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { hrmsConstants } from "../../../interfaces/hrmsTool/enum/hrmsEnum";
import { RewardCyclePhase } from "../../../interfaces/hrmsTool/enum/rewardsEnum";
import type {
  NominationAttributes,
  RewardCycleAttributes,
} from "../../../interfaces/hrmsTool/interface/rewardsInterface";
import * as rewardsService from "../../../utilities/hrmsUtilities/rewardsService";
import { dbOutput } from "../../../models";

/** Winner record with employee basic details (from findAll include) */
interface WinnerWithEmployee {
  awardType: string;
  employeeEmpUuid: string;
  employee?: { empFirstName?: string; empLastName?: string } | null;
}
import { getActiveEmployeesOfficialEmails } from "../../../utilities/hrmsUtilities/dbCalls";
import { sendRewardsEmail } from "../../../middlewares/sendHrmsEmail";

const toolName = hrmsConstants.HR_REPOSITORY;

const sendError = (res: Response, message: string, status = 400) =>
  res.status(status).json({ success: false, message });

/** Full rewards admin: super admin (900) or has any of the Rewards & Recognition permissions */
const isRewardsAdmin = async (
  employeeUuid: string,
  toolsAccess: Record<string, number> | undefined,
) => {
  const level = toolsAccess?.[toolName];
  if (level !== undefined && level >= 900) return true;
  const hasAny = await checkHrmsPermission(
    employeeUuid,
    [
      "RewardsRecognition_Admin_View",
      "RewardsRecognition_Process_Manage",
      "RewardsRecognition_Choose_Winner",
    ],
    toolName,
    toolsAccess,
  );
  if (hasAny) return true;
  return checkHrmsPermission(
    employeeUuid,
    "ActiveEmployee_update",
    toolName,
    toolsAccess,
  );
};

/** Admin view only: review nominations, manage citations, view nominees */
const hasRewardsAdminView = async (
  employeeUuid: string,
  toolsAccess: Record<string, number> | undefined,
) => {
  if (toolsAccess && toolsAccess[toolName] >= 900) return true;
  return checkHrmsPermission(
    employeeUuid,
    "RewardsRecognition_Admin_View",
    toolName,
    toolsAccess,
  );
};

/** Process manage: start/end nomination, start/end voting */
const hasRewardsProcessManage = async (
  employeeUuid: string,
  toolsAccess: Record<string, number> | undefined,
) => {
  if (toolsAccess && toolsAccess[toolName] >= 900) return true;
  return checkHrmsPermission(
    employeeUuid,
    "RewardsRecognition_Process_Manage",
    toolName,
    toolsAccess,
  );
};

/** Choose winner: announce winners */
const hasRewardsChooseWinner = async (
  employeeUuid: string,
  toolsAccess: Record<string, number> | undefined,
) => {
  if (toolsAccess && toolsAccess[toolName] >= 900) return true;
  return checkHrmsPermission(
    employeeUuid,
    "RewardsRecognition_Choose_Winner",
    toolName,
    toolsAccess,
  );
};

/** GET /api/hrms/rewards/dashboard - Dashboard data for current user */
export const getDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) {
      return sendError(res, "Employee context required", 401);
    }
    const yearQuery = Number(req.query.year);
    const selectedYear = Number.isInteger(yearQuery) ? yearQuery : undefined;
    
    const data = await rewardsService.getDashboardData(
      employeeUuid,
      selectedYear,
    );
    return res.json({
      success: true,
      message: "Rewards dashboard loaded successfully.",
      data,
    });
  } catch (e) {
    console.error("Rewards getDashboard error:", e);
    return sendError(
      res,
      e instanceof Error ? e.message : "Failed to load rewards dashboard.",
      500,
    );
  }
};

/** GET /api/hrms/rewards/current-cycle - Get or create current cycle */
export const getCurrentCycle = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const cycle = await rewardsService.getCurrentCycle();
    return res.json({
      success: true,
      message: "Current cycle retrieved successfully.",
      data: cycle,
    });
  } catch (e) {
    console.error("Rewards getCurrentCycle error:", e);
    return sendError(res, "Failed to get current rewards cycle.", 500);
  }
};

/** POST /api/hrms/rewards/nominate - Create nomination */
export const nominate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);

    const { cycleId, nomineeEmpUuid, citation } = req.body;
    if (
      !cycleId ||
      !nomineeEmpUuid ||
      !citation ||
      typeof citation !== "string"
    ) {
      return sendError(
        res,
        "cycleId, nomineeEmpUuid and citation are required.",
      );
    }
    if (nomineeEmpUuid === employeeUuid) {
      return sendError(res, "You cannot nominate yourself");
    }

    const cycle = await rewardsService.getCycleById(cycleId);
    if (!cycle) return sendError(res, "Cycle not found", 404);
    if (cycle.currentPhase !== RewardCyclePhase.NOMINATION) {
      return sendError(res, "Nominations are not open for this cycle.", 400);
    }

    await rewardsService.createNomination(
      cycleId,
      nomineeEmpUuid,
      employeeUuid,
      citation.trim(),
    );
    return res.json({
      success: true,
      message: "Nomination submitted successfully.",
    });
  } catch (e) {
    console.error("Rewards nominate error:", e);
    return sendError(
      res,
      e instanceof Error ? e.message : "Failed to submit nomination.",
      500,
    );
  }
};

/** GET /api/hrms/rewards/employees/search?q= - Search employees for nomination dropdown */
export const searchEmployees = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);

    const q = (req.query.q as string) ?? "";
    const list = await rewardsService.searchEmployees(q, employeeUuid);
    return res.json({ success: true, data: list });
  } catch (e) {
    console.error("Rewards searchEmployees error:", e);
    return sendError(res, "Employee search failed.", 500);
  }
};

/** GET /api/hrms/rewards/cycles/:cycleId/nominations - List nominations for cycle (admin: all; employee: own) */
export const getCycleNominations = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    if (!cycleId)     return sendError(res, "Invalid cycle ID.");

    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);

    const admin = await isRewardsAdmin(employeeUuid, req.user?.toolsAccess);
    const forVoting = req.query.forVoting === "true";

    const data = await rewardsService.getNominationsForCycle(cycleId, {
      includeRemoved: admin,
      forVoting,
    });
    return res.json({ success: true, message: "Nominations loaded successfully.", data });
  } catch (e) {
    console.error("Rewards getCycleNominations error:", e);
    return sendError(res, "Failed to load nominations.", 500);
  }
};

/** GET /api/hrms/rewards/cycles/:cycleId/nominees-for-voting - Nominees list for voting (with filters) */
export const getNomineesForVoting = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    if (!cycleId) return sendError(res, "Invalid cycle ID.");

    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);

    const cycle = await rewardsService.getCycleById(cycleId);
    if (!cycle) return sendError(res, "Cycle not found", 404);
    const phase = cycle.currentPhase;
    const winnersAnnounced = Boolean(cycle.winnersAnnouncedDate);

    if (
      phase === RewardCyclePhase.PENDING ||
      phase === RewardCyclePhase.NOMINATION
    ) {
      return sendError(
        res,
        "Nominees will show once voting starts.",
        400,
      );
    }

    if (phase === RewardCyclePhase.WINNERS && winnersAnnounced) {
      return sendError(
        res,
        "Voting has ended and winners have already been announced for this cycle.",
        400,
      );
    }

    const department = req.query.department as string | undefined;
    const sortBy = (req.query.sortBy as string) || "name_asc";

    const result = await rewardsService.getNomineesForVoting(
      cycleId,
      employeeUuid,
      {
        department,
        sortBy,
      },
    );
    return res.json({ success: true, message: "Nominees for voting loaded successfully.", data: result });
  } catch (e) {
    console.error("Rewards getNomineesForVoting error:", e);
    return sendError(res, "Failed to load nominees for voting.", 500);
  }
};

/** POST /api/hrms/rewards/vote - Cast or change vote. Uses employeeUuid from auth to find voter's department (employeeJobDetails) and set vote category (leadership_key => leadership_choice, else employee_choice). */
export const vote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { employeeUuid } = user as AuthenticatedUser;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);

    const { cycleId, nomineeEmpUuid } = req.body;
    if (!cycleId || !nomineeEmpUuid)
      return sendError(res, "cycleId and nomineeEmpUuid are required.");
    if (employeeUuid === nomineeEmpUuid) {
      return sendError(res, "You cannot vote for yourself.", 400);
    }

    const cycle = await rewardsService.getCycleById(cycleId);
    if (!cycle) return sendError(res, "Cycle not found", 404);
    if (cycle.currentPhase !== RewardCyclePhase.VOTING) {
      return sendError(
        res,
        "Voting is only allowed during the voting phase. Voting has ended for this cycle.",
        400,
      );
    }

    const { voted, vote: voteRecord } = await rewardsService.castVote(
      cycleId,
      nomineeEmpUuid,
      employeeUuid,
    );
    const message = voted ? "Vote recorded successfully." : "Vote removed successfully.";
    return res.json({
      success: true,
      message,
      data: { voted, vote: voteRecord },
    });
  } catch (e) {
    console.error("Rewards vote error:", e);
    const message = e instanceof Error ? e.message : "Failed to record vote.";
    const status = message.includes("cannot vote for yourself") ? 400 : 500;
    return sendError(res, message, status);
  }
};

/** GET /api/hrms/rewards/cycles/:cycleId/my-citations - Citations received by current user in cycle */
export const getMyCitationsForCycle = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    const data = await rewardsService.getMyCitationsForCycle(
      cycleId,
      employeeUuid,
    );
    return res.json({ success: true, message: "My citations loaded successfully.", data });
  } catch (e) {
    console.error("Rewards getMyCitationsForCycle error:", e);
    return sendError(res, "Failed to load my citations.", 500);
  }
};

/** GET /api/hrms/rewards/my-received-citations-history - Received citations for past completed cycles */
export const getMyReceivedCitationsHistory = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);

    const yearQuery = Number(req.query.year);
    const selectedYear = Number.isInteger(yearQuery) ? yearQuery : undefined;
    const data = await rewardsService.getMyPastReceivedCitations(employeeUuid, selectedYear);
    return res.json({
      success: true,
      message: "Received citations history loaded successfully.",
      data,
    });
  } catch (e) {
    console.error("Rewards getMyReceivedCitationsHistory error:", e);
    return sendError(res, "Failed to load received citations history.", 500);
  }
};

/** GET /api/hrms/rewards/cycles/:cycleId/nominees-for-announce - Admin: nominees with vote count for announce modal */
export const getNomineesForAnnounce = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    const canView = await hasRewardsAdminView(
      employeeUuid,
      req.user?.toolsAccess,
    );
    const canChoose = await hasRewardsChooseWinner(
      employeeUuid,
      req.user?.toolsAccess,
    );
    if (!canView && !canChoose) return sendError(res, "Forbidden", 403);

    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    if (!cycleId) return sendError(res, "Invalid cycle ID.");
    const data =
      await rewardsService.getNomineesWithVoteCountForAnnounce(cycleId);
    return res.json({ success: true, message: "Nominees for announce loaded successfully.", data });
  } catch (e) {
    console.error("Rewards getNomineesForAnnounce error:", e);
    return sendError(res, "Failed to load nominees for announce.", 500);
  }
};

/** POST /api/hrms/rewards/cycles/:cycleId/start-phase - Admin: start nomination/voting phase */
export const startPhase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    if (!(await hasRewardsProcessManage(employeeUuid, req.user?.toolsAccess))) {
      return sendError(res, "Forbidden", 403);
    }

    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    const { phase } = req.body;
    if (!cycleId || !phase) return sendError(res, "cycleId and phase are required.");
    if (
      ![RewardCyclePhase.NOMINATION, RewardCyclePhase.VOTING].includes(phase)
    ) {
      return sendError(res, "Invalid phase. Allowed: nomination, voting.");
    }

    const cycle = await rewardsService.getCycleById(cycleId);
    if (!cycle) return sendError(res, "Rewards cycle not found.", 404);

    await rewardsService.startPhase(cycleId, phase, employeeUuid);

    const updated = await rewardsService.getCycleById(cycleId);
    const phaseMessage =
      phase === RewardCyclePhase.NOMINATION
        ? "Nomination phase started successfully."
        : "Voting phase started successfully.";
    res.json({ success: true, data: updated, message: phaseMessage });

    if (phase === RewardCyclePhase.NOMINATION) {
      const monthYear = `${rewardsService.getMonthName(cycle.month)} ${cycle.year}`;
      const message = `Nominations started for ${monthYear}. Nominate a peer who went above and beyond and deserves recognition.`;
      (async () => {
        try {
          await createHRMSNotification({
            notification_type: hrmsNotificationTypes.ORGANIZATION_UPDATES,
            message,
            sender_employee_id: employeeUuid,
          });
        } catch (err) {
          console.error("Rewards startPhase notification error:", err);
        }
      })();
    }

    // Send rewards emails asynchronously (non-blocking) so API response is not delayed
    if (phase === RewardCyclePhase.NOMINATION && process.env.HRMS_SMTP_FROM) {
      const monthYear = `${rewardsService.getMonthName(cycle.month)} ${cycle.year}`;
      const subject = `Nominations started for ${monthYear}`;
      const redirectUrl = process.env.HRMS_DASHBOARD_URL
        ? `${process.env.HRMS_DASHBOARD_URL.replace(/\/dashboard\/?$/, "")}/rewards-recognitions?action=nominate`
        : "";
      (async () => {
        try {
          const employees = await getActiveEmployeesOfficialEmails();
          if (employees.length === 0) return;
          for (const emp of employees) {
            try {
              await sendRewardsEmail(emp.empOfficialEmail, {
                subject,
                monthYear,
                redirectUrl,
              });
            } catch (emailErr) {
              console.error("Rewards email error for", emp.empUuid, emailErr);
            }
          }
        } catch (e) {
          console.error("Rewards nomination emails background send error:", e);
        }
      })();
    }
    return;
  } catch (e) {
    console.error("Rewards startPhase error:", e);
    const message = e instanceof Error ? e.message : "Failed to start rewards phase.";
    const isClientError =
      message.includes("complete group citation") ||
      message.includes("Process already completed") ||
      message.includes("Voting phase can only be started");
    const status = isClientError ? 400 : 500;
    return sendError(res, message, status);
  }
};

/** POST /api/hrms/rewards/cycles/:cycleId/end-phase - Admin: end nomination/voting phase */
export const endPhase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    if (!(await hasRewardsProcessManage(employeeUuid, req.user?.toolsAccess))) {
      return sendError(res, "Forbidden", 403);
    }

    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    const { phase } = req.body;
    if (!cycleId || !phase) return sendError(res, "cycleId and phase are required.");

    await rewardsService.endPhase(cycleId, phase, employeeUuid);
    const updated = await rewardsService.getCycleById(cycleId);
    const phaseMessage =
      phase === RewardCyclePhase.NOMINATION
        ? "Nomination phase ended successfully."
        : "Voting phase ended successfully.";
    return res.json({ success: true, data: updated, message: phaseMessage });
  } catch (e) {
    console.error("Rewards endPhase error:", e);
    const message = e instanceof Error ? e.message : "Failed to end rewards phase.";
    const status = message.includes("complete group citation") ? 400 : 500;
    return sendError(res, message, status);
  }
};

/** POST /api/hrms/rewards/nominations/:nominationId/remove - Admin: remove a citation */
export const removeNomination = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    if (!(await hasRewardsAdminView(employeeUuid, req.user?.toolsAccess))) {
      return sendError(res, "Forbidden", 403);
    }

    const nominationId =
      (Array.isArray(req.params.nominationId)
        ? req.params.nominationId[0]
        : req.params.nominationId
      )?.trim?.() ?? "";
    const { removalReason } = req.body || {};
    if (!nominationId) return sendError(res, "Invalid nomination ID.");

    const existingNom = await dbOutput.nomination.findByPk(nominationId, {
      attributes: ["cycleId"],
    });
    if (existingNom?.cycleId) {
      const cycle = await rewardsService.getCycleById(existingNom.cycleId);
      if (cycle && cycle.currentPhase !== RewardCyclePhase.NOMINATION) {
        return sendError(
          res,
          "Citations can only be removed during the nomination phase.",
          400,
        );
      }
    }

    const nom = await rewardsService.removeNomination(
      nominationId,
      employeeUuid,
      removalReason ?? null,
    );
    const nomAttrs = nom.get({ plain: true }) as NominationAttributes;
    const nominatedByEmpUuid = nomAttrs.nominatedByEmpUuid;
    const nomineeEmpUuid = nomAttrs.nomineeEmpUuid;

    res.json({ success: true, message: "Citation removed successfully." });

    if (nominatedByEmpUuid) {
      (async () => {
        try {
          const nomineeBasic = await dbOutput.employeeBasicDetails.findOne({
            where: { empUuid: nomineeEmpUuid },
            attributes: ["empFirstName", "empLastName"],
          });
          const nomineeName = nomineeBasic
            ? `${nomineeBasic.empFirstName || ""} ${nomineeBasic.empLastName || ""}`.trim() ||
              "the nominee"
            : "the nominee";
          await createHRMSNotification({
            notification_type: hrmsNotificationTypes.MY_UPDATES,
            message: `Your citation for ${nomineeName} was removed. Please contact HR for more details.`,
            sender_employee_id: employeeUuid,
            recipient_employee_id: nominatedByEmpUuid,
          });
        } catch (err) {
          console.error("Rewards removeNomination notification error:", err);
        }
      })();
    }
    return;
  } catch (e) {
    console.error("Rewards removeNomination error:", e);
    return sendError(
      res,
      e instanceof Error ? e.message : "Failed to remove citation",
      500,
    );
  }
};

/** GET /api/hrms/rewards/cycles/:cycleId/review-nominees - Admin: nominees for Review Nominations tab */
export const getReviewNominees = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    if (!(await hasRewardsAdminView(employeeUuid, req.user?.toolsAccess))) {
      return sendError(res, "Forbidden", 403);
    }

    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    if (!cycleId) return sendError(res, "Invalid cycle ID.");

    const data = await rewardsService.getReviewNominees(cycleId);
    return res.json({ success: true, message: "Review nominees loaded successfully.", data });
  } catch (e) {
    console.error("Rewards getReviewNominees error:", e);
    return sendError(res, "Failed to load review nominees.", 500);
  }
};

/** GET /api/hrms/rewards/cycles/:cycleId/nominees/:nomineeEmpUuid/citations - Admin: get all citations for a nominee */
export const getNomineeCitations = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    if (!(await hasRewardsAdminView(employeeUuid, req.user?.toolsAccess))) {
      return sendError(res, "Forbidden", 403);
    }

    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    const nomineeEmpUuid = Array.isArray(req.params.nomineeEmpUuid)
      ? req.params.nomineeEmpUuid[0]
      : req.params.nomineeEmpUuid;
    if (!cycleId || !nomineeEmpUuid)
      return sendError(res, "cycleId and nomineeEmpUuid are required.");

    const cycle = await rewardsService.getCycleById(cycleId);
    if (!cycle) return sendError(res, "Rewards cycle not found.", 404);
    if (cycle.currentPhase !== RewardCyclePhase.NOMINATION) {
      return sendError(
        res,
        "Manage citations is only available during the nomination phase.",
        400,
      );
    }

    const data = await rewardsService.getCitationsWithGroupedForNominee(
      cycleId,
      nomineeEmpUuid,
    );
    return res.json({ success: true, message: "Nominee citations loaded successfully.", data });
  } catch (e) {
    console.error("Rewards getNomineeCitations error:", e);
    return sendError(res, "Failed to load nominee citations.", 500);
  }
};

/** PUT /api/hrms/rewards/cycles/:cycleId/grouped-citation - Admin: create/update grouped citation */
export const upsertGroupedCitation = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    if (!(await hasRewardsAdminView(employeeUuid, req.user?.toolsAccess))) {
      return sendError(res, "Forbidden", 403);
    }

    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    const { nomineeEmpUuid, groupedCitation } = req.body;
    if (!cycleId || !nomineeEmpUuid || groupedCitation == null) {
      return sendError(
        res,
        "cycleId, nomineeEmpUuid and groupedCitation are required.",
      );
    }

    const cycle = await rewardsService.getCycleById(cycleId);
    if (!cycle) return sendError(res, "Rewards cycle not found.", 404);
    if (cycle.currentPhase !== RewardCyclePhase.NOMINATION) {
      return sendError(
        res,
        "Group citation can only be updated during the nomination phase. Voting has started or ended.",
        400,
      );
    }

    await rewardsService.upsertGroupedCitation(
      cycleId,
      nomineeEmpUuid,
      String(groupedCitation).trim(),
      employeeUuid,
    );
    return res.json({ success: true, message: "Grouped citation saved successfully." });
  } catch (e) {
    console.error("Rewards upsertGroupedCitation error:", e);
    return sendError(
      res,
      e instanceof Error ? e.message : "Failed to save grouped citation.",
      500,
    );
  }
};

/** POST /api/hrms/rewards/cycles/:cycleId/announce-winners - Admin: announce winners */
export const announceWinners = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const employeeUuid = req.user?.employeeUuid;
    if (!employeeUuid) return sendError(res, "Employee context required", 401);
    if (!(await hasRewardsChooseWinner(employeeUuid, req.user?.toolsAccess))) {
      return sendError(res, "Forbidden", 403);
    }

    const cycleId =
      (Array.isArray(req.params.cycleId)
        ? req.params.cycleId[0]
        : req.params.cycleId
      )?.trim?.() ?? "";
    const { employeeChoiceEmpUuid, leadershipChoiceEmpUuid } = req.body;
    if (!cycleId) {
      return sendError(res, "cycleId is required.");
    }

    const cycle = await rewardsService.getCycleById(cycleId);
    if (!cycle) return sendError(res, "Rewards cycle not found.", 404);
    if (cycle.currentPhase !== RewardCyclePhase.WINNERS) {
      return sendError(
        res,
        "Winners can only be chosen after voting has ended.",
        400,
      );
    }

    // Check if ending without winners (no nominees case)
    const endWithoutWinners =
      !employeeChoiceEmpUuid && !leadershipChoiceEmpUuid;

    if (endWithoutWinners) {
      // End phase without selecting winners
      await rewardsService.endPhaseWithoutWinners(cycleId, employeeUuid);
      const updated = await rewardsService.getCycleById(cycleId);
      return res.json({
        success: true,
        data: updated,
        message: "Phase ended without winners.",
      });
    }

    // Normal flow - require both winners
    if (!employeeChoiceEmpUuid || !leadershipChoiceEmpUuid) {
      return sendError(
        res,
        "Both employeeChoiceEmpUuid and leadershipChoiceEmpUuid are required.",
      );
    }

    await rewardsService.announceWinners(
      cycleId,
      employeeChoiceEmpUuid,
      leadershipChoiceEmpUuid,
      employeeUuid,
    );

    const updated = await rewardsService.getCycleById(cycleId);
    res.json({ success: true, data: updated, message: "Winners announced successfully." });

    const cycleAttrs = cycle.get({ plain: true }) as RewardCycleAttributes;
    const monthYear = `${rewardsService.getMonthName(cycleAttrs.month)} ${cycleAttrs.year}`;
    (async () => {
      try {
        const winners = await dbOutput.winner.findAll({
          where: { cycleId },
          include: [
            {
              model: dbOutput.employeeBasicDetails,
              as: "employee",
              attributes: ["empUuid", "empFirstName", "empLastName"],
            },
          ],
        });
        const winnerList = winners.map((w) =>
          w.get({ plain: true }),
        ) as WinnerWithEmployee[];
        const employeeChoiceWinner = winnerList.find(
          (w) => w.awardType === "employee_choice",
        );
        const leadershipChoiceWinner = winnerList.find(
          (w) => w.awardType === "leadership_choice",
        );

        const empChoiceName = employeeChoiceWinner?.employee
          ? `${employeeChoiceWinner.employee.empFirstName || ""} ${employeeChoiceWinner.employee.empLastName || ""}`.trim()
          : "";
        const leadChoiceName = leadershipChoiceWinner?.employee
          ? `${leadershipChoiceWinner.employee.empFirstName || ""} ${leadershipChoiceWinner.employee.empLastName || ""}`.trim()
          : "";

        const isSameEmployee =
          employeeChoiceEmpUuid === leadershipChoiceEmpUuid;

        const orgMessage = isSameEmployee
          ? `${empChoiceName || "An employee"} won both Employee's Choice and Leadership Choice rewards for ${monthYear}!`
          : `${empChoiceName || "An employee"} won Employee's Choice and ${leadChoiceName || "an employee"} won Leadership Choice for ${monthYear}!`;

        await createHRMSNotification({
          notification_type: hrmsNotificationTypes.ORGANIZATION_UPDATES,
          message: orgMessage,
          sender_employee_id: employeeUuid,
        });

        if (employeeChoiceWinner?.employeeEmpUuid) {
          const empMsg = isSameEmployee
            ? `Congrats on winning both Employee's Choice and Leadership Choice for ${monthYear}! Keep up the Good Work.`
            : `Congrats on winning the Employee's Choice award for ${monthYear}! Keep up the Good Work.`;
          await createHRMSNotification({
            notification_type: hrmsNotificationTypes.MY_UPDATES,
            message: empMsg,
            sender_employee_id: employeeUuid,
            recipient_employee_id: employeeChoiceWinner.employeeEmpUuid,
          });
        }
        if (leadershipChoiceWinner?.employeeEmpUuid && !isSameEmployee) {
          await createHRMSNotification({
            notification_type: hrmsNotificationTypes.MY_UPDATES,
            message: `Congrats on winning the Leadership Choice award for ${monthYear}! Keep up the Good Work.`,
            sender_employee_id: employeeUuid,
            recipient_employee_id: leadershipChoiceWinner.employeeEmpUuid,
          });
        }
      } catch (err) {
        console.error("Rewards announceWinners notification error:", err);
      }
    })();
    return;
  } catch (e) {
    console.error("Rewards announceWinners error:", e);
    return sendError(
      res,
      e instanceof Error ? e.message : "Failed to announce winners.",
      500,
    );
  }
};
