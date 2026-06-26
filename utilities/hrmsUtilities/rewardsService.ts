/**
 * Rewards & Recognition - service layer (DB operations and business logic)
 */

import { Op, Transaction } from "sequelize";
import { dbOutput } from "../../models";
import {
  RewardCyclePhase,
  RewardCycleStatus,
  PhaseAuditPhaseName,
  PhaseAuditAction,
  AwardType,
} from "../../interfaces/hrmsTool/enum/rewardsEnum";
import type {
  RewardCycleAttributes,
  GroupedCitationAttributes,
} from "../../interfaces/hrmsTool/interface/rewardsInterface";

const rewardCycle = dbOutput.rewardCycle;
const nomination = dbOutput.nomination;
const groupedCitation = dbOutput.groupedCitation;
const vote = dbOutput.vote;
const winner = dbOutput.winner;
const phaseAuditLog = dbOutput.phaseAuditLog;
const employeeBasicDetails = dbOutput.employeeBasicDetails;
const employeeJobDetails = dbOutput.employeeJobDetails;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Department value that counts as leadership for vote category */
const LEADERSHIP_DEPARTMENT_KEY = "leadership_key";

export const getMonthName = (month: number) => MONTH_NAMES[month - 1] || "";

/** Resolve vote category from voter's department: leadership_key => leadership_choice, else employee_choice */
export const getVoterVoteCategory = async (
  votedByEmpUuid: string,
): Promise<string> => {
  const job = await employeeJobDetails.findOne({
    where: { empUuid: votedByEmpUuid, isDeleted: false },
    attributes: ["empDepartment"],
    order: [["effectiveDate", "DESC"]],
  });
  const jobRecord = job?.get({ plain: true }) as
    | { empDepartment?: string }
    | undefined;
  const dept = jobRecord?.empDepartment;
  return dept === LEADERSHIP_DEPARTMENT_KEY
    ? AwardType.LEADERSHIP_CHOICE
    : AwardType.EMPLOYEE_CHOICE;
};

/** Get or create current cycle for given month/year */
export const getOrCreateCycle = async (
  month: number,
  year: number,
  transaction?: Transaction,
) => {
  let cycle = await rewardCycle.findOne({
    where: { month, year },
    transaction,
  });
  if (!cycle) {
    try {
      cycle = await rewardCycle.create(
        {
          month,
          year,
          currentPhase: RewardCyclePhase.PENDING,
          status: RewardCycleStatus.ACTIVE,
        },
        { transaction },
      );
    } catch (error) {
      // Handle race condition: cycle might have been created by another request
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "ER_DUP_ENTRY"
      ) {
        cycle = await rewardCycle.findOne({
          where: { month, year },
          transaction,
        });
      } else {
        throw error;
      }
    }
  }
  return cycle;
};

/**
 * Get the cycle that should be treated as "current" for the UI.
 * 
 * Priority:
 * 1. If previous month exists and is NOT completed → return it (process not finished)
 * 2. If previous month is COMPLETED with winners announced AND current month hasn't started nomination → return previous month (show past winners/citations until next phase)
 * 3. Otherwise → return or create current month's cycle
 * 
 * This ensures received citations persist until the next month's nomination phase actually begins.
 */
export const getEffectiveCurrentCycle = async (transaction?: Transaction) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const prevCycle = await rewardCycle.findOne({
    where: { month: prevMonth, year: prevYear },
    transaction,
  });

  const prevAttrs = prevCycle?.get({ plain: true }) as RewardCycleAttributes | undefined;

  // Case 1: Previous month cycle exists but is not completed → return it
  if (prevAttrs && prevAttrs.status !== RewardCycleStatus.COMPLETED) {
    return prevCycle!;
  }

  // Case 2: Previous month is completed with winners announced → check current month
  if (
    prevAttrs &&
    prevAttrs.status === RewardCycleStatus.COMPLETED &&
    prevAttrs.winnersAnnouncedDate
  ) {
    // Get or create current month's cycle
    const currentCycle = await getOrCreateCycle(currentMonth, currentYear, transaction);
    const currentAttrs = currentCycle.get({ plain: true }) as RewardCycleAttributes;

    // If current month hasn't started nomination phase yet, keep showing previous month
    // This allows past citations to persist until next month's nomination starts
    if (currentAttrs.currentPhase === RewardCyclePhase.PENDING) {
      return prevCycle!;
    }
  }

  // Case 3: Default → return current month's cycle
  return getOrCreateCycle(currentMonth, currentYear, transaction);
};

/** Get current active cycle: prefers incomplete previous month so process can be completed, else current month */
export const getCurrentCycle = async (transaction?: Transaction) => {
  return getEffectiveCurrentCycle(transaction);
};

/** Get cycle by id */
export const getCycleById = async (
  cycleId: string,
  transaction?: Transaction,
) => {
  return rewardCycle.findByPk(cycleId, { transaction });
};

/** Get dashboard data: current cycle (effective = incomplete previous month or current month) + past winners */
export const getDashboardData = async (
  empUuid: string,
  year?: number,
) => {
  const currentCycle = await getEffectiveCurrentCycle();
  await currentCycle.reload();

  const effectiveAttrs = currentCycle.get({ plain: true }) as RewardCycleAttributes;
  const effectiveMonth = effectiveAttrs.month;
  const effectiveYear = effectiveAttrs.year;

  // Past cycles with winners: cycles before the effective current cycle (so when showing Feb, past = Jan and earlier)
  const winnerCycleRows = await winner.findAll({
    attributes: ["cycleId"],
    raw: true,
  });
  const pastCycleIds = [
    ...new Set(
      (winnerCycleRows || [])
        .map((r: { cycleId?: string }) => r.cycleId)
        .filter(Boolean),
    ),
  ] as string[];
  const pastCyclesWithWinners =
    pastCycleIds.length === 0
      ? []
      : await rewardCycle.findAll({
          where: {
            id: { [Op.in]: pastCycleIds },
            ...(typeof year === "number" ? { year } : {}),
            [Op.or]: [
              { year: { [Op.lt]: effectiveYear } },
              { year: effectiveYear, month: { [Op.lt]: effectiveMonth } },
            ],
          },
          order: [
            ["year", "DESC"],
            ["month", "DESC"],
          ],
          limit: 12,
          include: [
            {
              model: dbOutput.winner,
              as: "winners",
              include: [
                {
                  model: employeeBasicDetails,
                  as: "employee",
                  attributes: ["empUuid", "empFirstName", "empLastName"],
                },
              ],
            },
          ],
        });

  const myNominationsForCurrentCycle = await nomination.findAll({
    where: {
      cycleId: currentCycle.id,
      nominatedByEmpUuid: empUuid,
      isRemoved: false,
    },
    include: [
      {
        model: employeeBasicDetails,
        as: "nominee",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
    ],
  });

  const myVoteForCurrentCycle =
    currentCycle.currentPhase === RewardCyclePhase.VOTING ||
    currentCycle.currentPhase === RewardCyclePhase.WINNERS
      ? await vote.findOne({
          where: { cycleId: currentCycle.id, votedByEmpUuid: empUuid },
        })
      : null;

  const myAwards = await winner.findAll({
    where: { employeeEmpUuid: empUuid },
    include: [
      {
        model: rewardCycle,
        as: "cycle",
        attributes: ["id", "month", "year"],
        ...(typeof year === "number" ? { where: { year }, required: true } : {}),
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  const myNominationsAll = await nomination.findAll({
    where: { nominatedByEmpUuid: empUuid, isRemoved: false },
    include: [
      {
        model: employeeBasicDetails,
        as: "nominee",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
      {
        model: rewardCycle,
        as: "cycle",
        attributes: ["id", "month", "year"],
        ...(typeof year === "number" ? { where: { year }, required: true } : {}),
      },
    ],
    order: [["createdAt", "DESC"]],
    limit: 200,
  });

  let currentCycleWinners: Array<Record<string, unknown>> = [];
  if (currentCycle.currentPhase === RewardCyclePhase.WINNERS) {
    const currentWinners = await winner.findAll({
      where: { cycleId: currentCycle.id },
      include: [
        {
          model: employeeBasicDetails,
          as: "employee",
          attributes: ["empUuid", "empFirstName", "empLastName"],
        },
      ],
    });
    currentCycleWinners = currentWinners.map((w) => w.get({ plain: true }));
  }

  return {
    currentCycle: currentCycle.get({ plain: true }),
    pastCyclesWithWinners: pastCyclesWithWinners.map((c) =>
      c.get({ plain: true }),
    ),
    myNominationsForCurrentCycle: myNominationsForCurrentCycle.map((n) =>
      n.get({ plain: true }),
    ),
    myNominationsAll: myNominationsAll.map((n) => n.get({ plain: true })),
    myVoteForCurrentCycle: myVoteForCurrentCycle?.get({ plain: true }) ?? null,
    myAwards: myAwards.map((a) => a.get({ plain: true })),
    currentCycleWinners,
  };
};

/** Create nomination */
export const createNomination = async (
  cycleId: string,
  nomineeEmpUuid: string,
  nominatedByEmpUuid: string,
  citation: string,
  transaction?: Transaction,
) => {
  const existing = await nomination.findOne({
    where: { cycleId, nomineeEmpUuid, nominatedByEmpUuid },
    transaction,
  });
  if (existing) {
    throw new Error("You have already nominated this employee for this cycle.");
  }
  return nomination.create(
    {
      cycleId,
      nomineeEmpUuid,
      nominatedByEmpUuid,
      citation,
      isRemoved: false,
    },
    { transaction },
  );
};

/** Get nominations for a cycle (for admin review or for voting list) */
export const getNominationsForCycle = async (
  cycleId: string,
  options?: { includeRemoved?: boolean; forVoting?: boolean },
) => {
  const where: Record<string, unknown> = { cycleId };
  if (options?.includeRemoved !== true) {
    where.isRemoved = false;
  }

  const nominationsList = await nomination.findAll({
    where,
    include: [
      {
        model: employeeBasicDetails,
        as: "nominee",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
      {
        model: employeeBasicDetails,
        as: "nominatedBy",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
    ],
  });

  if (options?.forVoting) {
    const grouped = await groupedCitation.findAll({ where: { cycleId } });
    const groupedByNominee = new Map(
      grouped.map((g) => [g.nomineeEmpUuid, g.groupedCitation]),
    );

    interface NomineeRow {
      nomineeEmpUuid: string;
      citation: string;
      nominee?: {
        empUuid?: string;
        empFirstName?: string;
        empLastName?: string;
      };
      nominatedBy?: {
        empUuid?: string;
        empFirstName?: string;
        empLastName?: string;
      };
    }
    const byNominee = new Map<
      string,
      {
        nominee: NomineeRow["nominee"];
        nominatedBy: string[];
        citations: string[];
      }
    >();
    for (const n of nominationsList) {
      const nom = n.get({ plain: true }) as NomineeRow;
      const key = nom.nomineeEmpUuid;
      if (!byNominee.has(key)) {
        byNominee.set(key, {
          nominee: nom.nominee,
          nominatedBy: [],
          citations: [],
        });
      }
      const entry = byNominee.get(key)!;
      entry.citations.push(nom.citation);
      if (nom.nominatedBy?.empUuid) {
        const name = [nom.nominatedBy.empFirstName, nom.nominatedBy.empLastName]
          .filter(Boolean)
          .join(" ");
        if (!entry.nominatedBy.includes(name)) entry.nominatedBy.push(name);
      }
    }

    const result: Array<{
      nomineeEmpUuid: string;
      nominee: NomineeRow["nominee"];
      nominatedBy: string[];
      citationDisplay: string;
      hasGroupCitation: boolean;
      groupedCitation?: string;
    }> = [];
    byNominee.forEach((v, nomineeEmpUuid) => {
      const groupedText = groupedByNominee.get(nomineeEmpUuid);
      const hasGroupCitation =
        typeof groupedText === "string" && groupedText.trim().length > 0;
      const citationDisplay = hasGroupCitation
        ? (groupedText as string).trim()
        : "";
      result.push({
        nomineeEmpUuid,
        nominee: v.nominee,
        nominatedBy: v.nominatedBy,
        citationDisplay,
        hasGroupCitation,
        ...(hasGroupCitation && { groupedCitation: citationDisplay }),
      });
    });
    return result;
  }

  return nominationsList.map((n) => n.get({ plain: true }));
};

/** Remove a single nomination (admin) */
export const removeNomination = async (
  nominationId: string,
  removedByEmpUuid: string,
  removalReason: string | null,
  transaction?: Transaction,
) => {
  const nom = await nomination.findByPk(nominationId, { transaction });
  if (!nom) throw new Error("Nomination not found.");
  await nom.update(
    {
      isRemoved: true,
      removedByEmpUuid,
      removedAt: new Date(),
      removalReason: removalReason ?? undefined,
    },
    { transaction },
  );
  return nom;
};

/** Get nominees for admin Review Nominations tab (grouped by nominee with hasGroupCitation) */
export const getReviewNominees = async (cycleId: string) => {
  const nominationsList = await nomination.findAll({
    where: { cycleId, isRemoved: false },
    include: [
      {
        model: employeeBasicDetails,
        as: "nominee",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
      {
        model: employeeBasicDetails,
        as: "nominatedBy",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
    ],
  });
  const grouped = await groupedCitation.findAll({ where: { cycleId } });
  const groupedByNominee = new Map(
    (grouped as GroupedCitationAttributes[]).map((g) => [
      g.nomineeEmpUuid,
      (g.groupedCitation || "").trim(),
    ]),
  );

  interface ReviewNomineeRow {
    id: string;
    nomineeEmpUuid: string;
    citation: string;
    nominee?: { empUuid?: string; empFirstName?: string; empLastName?: string };
    nominatedBy?: {
      empUuid?: string;
      empFirstName?: string;
      empLastName?: string;
    };
  }
  const byNominee = new Map<
    string,
    {
      nominee: ReviewNomineeRow["nominee"];
      nominatedBy: string[];
      citations: string[];
      nominationIds: string[];
    }
  >();
  for (const n of nominationsList) {
    const nom = n.get({ plain: true }) as ReviewNomineeRow;
    const key = nom.nomineeEmpUuid;
    if (!byNominee.has(key)) {
      byNominee.set(key, {
        nominee: nom.nominee,
        nominatedBy: [],
        citations: [],
        nominationIds: [],
      });
    }
    const entry = byNominee.get(key)!;
    entry.citations.push(nom.citation);
    entry.nominationIds.push(nom.id);
    if (nom.nominatedBy?.empUuid) {
      const name = [nom.nominatedBy.empFirstName, nom.nominatedBy.empLastName]
        .filter(Boolean)
        .join(" ");
      if (!entry.nominatedBy.includes(name)) entry.nominatedBy.push(name);
    }
  }

  return Array.from(byNominee.entries()).map(([nomineeEmpUuid, v]) => {
    const groupText = groupedByNominee.get(nomineeEmpUuid);
    const hasGroupCitation =
      typeof groupText === "string" && groupText.length > 0;
    const citationDisplay = hasGroupCitation
      ? groupText
      : v.citations.join("\n\n");
    return {
      nomineeEmpUuid,
      nominee: v.nominee,
      nominatedBy: v.nominatedBy,
      citations: v.citations,
      nominationIds: v.nominationIds,
      citationDisplay,
      hasGroupCitation,
    };
  });
};

/** Get citations for a nominee in a cycle (for admin Manage Citations modal) */
export const getNominationsByNominee = async (
  cycleId: string,
  nomineeEmpUuid: string,
) => {
  return nomination.findAll({
    where: { cycleId, nomineeEmpUuid, isRemoved: false },
    include: [
      {
        model: employeeBasicDetails,
        as: "nominatedBy",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
    ],
  });
};

/** Get citations + grouped citation for a nominee (for Manage Citations modal) */
export const getCitationsWithGroupedForNominee = async (
  cycleId: string,
  nomineeEmpUuid: string,
) => {
  const [citations, groupedRecord] = await Promise.all([
    getNominationsByNominee(cycleId, nomineeEmpUuid),
    groupedCitation.findOne({
      where: { cycleId, nomineeEmpUuid },
      attributes: ["groupedCitation"],
    }),
  ]);
  const groupedCitationText = groupedRecord?.groupedCitation?.trim() ?? "";
  return {
    citations: citations.map((c) => c.get({ plain: true })),
    groupedCitation: groupedCitationText,
  };
};

/** Create or update grouped citation (admin) */
export const upsertGroupedCitation = async (
  cycleId: string,
  nomineeEmpUuid: string,
  groupedCitationText: string,
  createdByEmpUuid: string,
  transaction?: Transaction,
) => {
  const [record] = await groupedCitation.findOrCreate({
    where: { cycleId, nomineeEmpUuid },
    defaults: {
      cycleId,
      nomineeEmpUuid,
      groupedCitation: groupedCitationText,
      createdByEmpUuid,
    },
    transaction,
  });
  if (record.groupedCitation !== groupedCitationText) {
    await record.update(
      { groupedCitation: groupedCitationText },
      { transaction },
    );
  }
  return record;
};

/** Cast or remove vote. Vote category (employee_choice | leadership_choice) is set from voter's department (leadership_key => leadership_choice). */
export const castVote = async (
  cycleId: string,
  nomineeEmpUuid: string,
  votedByEmpUuid: string,
  transaction?: Transaction,
) => {
  if (votedByEmpUuid === nomineeEmpUuid) {
    throw new Error("You cannot vote for yourself.");
  }
  const voteCategory = await getVoterVoteCategory(votedByEmpUuid);
  const existing = await vote.findOne({
    where: { cycleId, votedByEmpUuid },
    transaction,
  });
  if (existing) {
    if (existing.nomineeEmpUuid === nomineeEmpUuid) {
      await existing.destroy({ transaction });
      return { voted: false, vote: null };
    }
    await existing.update({ nomineeEmpUuid, voteCategory }, { transaction });
    return { voted: true, vote: existing };
  }
  const newVote = await vote.create(
    { cycleId, nomineeEmpUuid, votedByEmpUuid, voteCategory },
    { transaction },
  );
  return { voted: true, vote: newVote };
};

/** Get vote count per nominee for a cycle. Optionally filter by voteCategory (employee_choice | leadership_choice). */
export const getVoteCountsForCycle = async (
  cycleId: string,
  options?: { voteCategory?: string },
) => {
  const where: Record<string, unknown> = { cycleId };
  if (options?.voteCategory) {
    where.voteCategory = options.voteCategory;
  }
  const votesList = await vote.findAll({
    where,
    attributes: ["nomineeEmpUuid"],
  });
  const counts = new Map<string, number>();
  for (const v of votesList) {
    counts.set(v.nomineeEmpUuid, (counts.get(v.nomineeEmpUuid) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([nomineeEmpUuid, voteCount]) => ({
    nomineeEmpUuid,
    voteCount,
  }));
};

/** Get nominees for voting screen with citation and vote count */
export const getNomineesForVoting = async (
  cycleId: string,
  votedByEmpUuid: string,
  filters?: { department?: string; sortBy?: string },
) => {
  const nomineesWithCitation = await getNominationsForCycle(cycleId, {
    forVoting: true,
  });
  const voteCounts = await getVoteCountsForCycle(cycleId);
  const countMap = new Map(
    voteCounts.map((c) => [c.nomineeEmpUuid, c.voteCount]),
  );

  const myVote = await vote.findOne({
    where: { cycleId, votedByEmpUuid },
  });
  const votedNomineeEmpUuid = myVote?.nomineeEmpUuid ?? null;

  interface NomineeWithCitation {
    nomineeEmpUuid: string;
    nominee?: { empFirstName?: string };
    [key: string]: unknown;
  }
  const empUuids = [
    ...new Set(
      nomineesWithCitation.map((n: NomineeWithCitation) => n.nomineeEmpUuid),
    ),
  ];
  const jobDetails =
    empUuids.length > 0
      ? await employeeJobDetails.findAll({
          where: { empUuid: { [Op.in]: empUuids }, isDeleted: false },
          attributes: ["empUuid", "empDepartment"],
        })
      : [];

  interface JobRow {
    empUuid: string;
    empDepartment: string;
  }
  const jobMap = new Map(
    (jobDetails as JobRow[]).map((j) => [j.empUuid, j.empDepartment]),
  );

  let list: NomineeWithCitation[] = nomineesWithCitation.map(
    (n: NomineeWithCitation) => ({
      ...n,
      department: jobMap.get(n.nomineeEmpUuid) ?? null,
      voteCount: countMap.get(n.nomineeEmpUuid) ?? 0,
      hasVoted: n.nomineeEmpUuid === votedNomineeEmpUuid,
    }),
  );

  if (filters?.department) {
    list = list.filter((n) => n.department === filters.department);
  }
  const sortBy = filters?.sortBy || "name_asc";
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  if (sortBy === "name_asc")
    list.sort((a, b) =>
      str(a.nominee?.empFirstName).localeCompare(str(b.nominee?.empFirstName)),
    );
  if (sortBy === "name_desc")
    list.sort((a, b) =>
      str(b.nominee?.empFirstName).localeCompare(str(a.nominee?.empFirstName)),
    );
  if (sortBy === "dept_asc")
    list.sort((a, b) => str(a.department).localeCompare(str(b.department)));
  if (sortBy === "dept_desc")
    list.sort((a, b) => str(b.department).localeCompare(str(a.department)));

  return { list, votedNomineeEmpUuid };
};

/** Start phase (admin) */
export const startPhase = async (
  cycleId: string,
  phase: RewardCyclePhase,
  triggeredByEmpUuid: string,
  transaction?: Transaction,
) => {
  const cycle = await rewardCycle.findByPk(cycleId, { transaction });
  if (!cycle) throw new Error("Cycle not found.");

  const cycleAttrs = cycle.get({ plain: true }) as RewardCycleAttributes;
  const currentPhase = cycleAttrs.currentPhase;
  const monthYear = `${getMonthName(cycleAttrs.month)} ${cycleAttrs.year}`;

  if (phase === RewardCyclePhase.NOMINATION) {
    if (currentPhase !== RewardCyclePhase.PENDING) {
      throw new Error(
        `Process already completed for ${monthYear}. You can start the next cycle when it's available.`,
      );
    }
  } else if (phase === RewardCyclePhase.VOTING) {
    if (currentPhase !== RewardCyclePhase.NOMINATION) {
      throw new Error(
        currentPhase === RewardCyclePhase.WINNERS
          ? `Process already completed for ${monthYear}. You can start the next cycle when it's available.`
          : `Voting phase for ${monthYear} can only be started after the nomination phase is active.`,
      );
    }
  }

  if (phase === RewardCyclePhase.VOTING) {
    const nominationsList = await nomination.findAll({
      where: { cycleId, isRemoved: false },
      attributes: ["nomineeEmpUuid"],
      transaction,
    });
    const nomineeEmpUuids = Array.from(
      new Set(
        nominationsList.map(
          (n) =>
            (n.get({ plain: true }) as { nomineeEmpUuid: string })
              .nomineeEmpUuid,
        ),
      ),
    ) as string[];
    if (nomineeEmpUuids.length > 0) {
      const grouped = await groupedCitation.findAll({
        where: { cycleId, nomineeEmpUuid: { [Op.in]: nomineeEmpUuids } },
        attributes: ["nomineeEmpUuid", "groupedCitation"],
        transaction,
      });
      const groupedByNominee = new Map<string, string>(
        (grouped as GroupedCitationAttributes[]).map((g) => [
          g.nomineeEmpUuid,
          (g.groupedCitation || "").trim(),
        ]),
      );
      const missing = nomineeEmpUuids.filter(
        (uuid) => !groupedByNominee.get(uuid),
      );
      if (missing.length > 0) {
        throw new Error(
          "Please complete group citation for all nominated employee.",
        );
      }
    }
  }

  const now = new Date();
  const updates: Partial<RewardCycleAttributes> = { currentPhase: phase };
  if (phase === RewardCyclePhase.NOMINATION) {
    updates.nominationStartDate = now;
  }
  if (phase === RewardCyclePhase.VOTING) {
    updates.nominationEndDate = now;
    updates.votingStartDate = now;
  }
  if (phase === RewardCyclePhase.WINNERS) {
    updates.votingEndDate = now;
  }

  await cycle.update(updates, { transaction });

  const phaseName =
    phase === RewardCyclePhase.NOMINATION
      ? PhaseAuditPhaseName.NOMINATION
      : phase === RewardCyclePhase.VOTING
        ? PhaseAuditPhaseName.VOTING
        : PhaseAuditPhaseName.WINNERS;

  await phaseAuditLog.create(
    {
      cycleId,
      phaseName,
      action: PhaseAuditAction.STARTED,
      triggeredByEmpUuid,
    },
    { transaction },
  );
  return cycle;
};

/** End phase (admin) */
export const endPhase = async (
  cycleId: string,
  phase: RewardCyclePhase,
  triggeredByEmpUuid: string,
  transaction?: Transaction,
) => {
  const cycle = await rewardCycle.findByPk(cycleId, { transaction });
  if (!cycle) throw new Error("Cycle not found.");

  const cycleAttrs = cycle.get({ plain: true }) as RewardCycleAttributes;
  const monthYear = `${getMonthName(cycleAttrs.month)} ${cycleAttrs.year}`;
  const now = new Date();
  if (phase === RewardCyclePhase.NOMINATION) {
    const nominationsList = await nomination.findAll({
      where: { cycleId, isRemoved: false },
      attributes: ["nomineeEmpUuid"],
      transaction,
    });
    const nomineeEmpUuids = Array.from(
      new Set(
        nominationsList.map(
          (n) =>
            (n.get({ plain: true }) as { nomineeEmpUuid: string })
              .nomineeEmpUuid,
        ),
      ),
    ) as string[];
    if (nomineeEmpUuids.length > 0) {
      const grouped = await groupedCitation.findAll({
        where: { cycleId, nomineeEmpUuid: { [Op.in]: nomineeEmpUuids } },
        attributes: ["nomineeEmpUuid", "groupedCitation"],
        transaction,
      });
      const groupedByNominee = new Map<string, string>(
        (grouped as GroupedCitationAttributes[]).map((g) => [
          g.nomineeEmpUuid,
          (g.groupedCitation || "").trim(),
        ]),
      );
      const missing = nomineeEmpUuids.filter(
        (uuid) => !groupedByNominee.get(uuid),
      );
      if (missing.length > 0) {
        throw new Error(
          `Please complete group citation for all nominated employees for ${monthYear} before ending the nomination phase.`,
        );
      }
    }
    await cycle.update(
      {
        nominationEndDate: now,
        votingStartDate: now,
        currentPhase: RewardCyclePhase.VOTING,
      },
      { transaction },
    );
  } else if (phase === RewardCyclePhase.VOTING) {
    await cycle.update(
      { votingEndDate: now, currentPhase: RewardCyclePhase.WINNERS },
      { transaction },
    );
  }

  const phaseName =
    phase === RewardCyclePhase.NOMINATION
      ? PhaseAuditPhaseName.NOMINATION
      : phase === RewardCyclePhase.VOTING
        ? PhaseAuditPhaseName.VOTING
        : PhaseAuditPhaseName.WINNERS;

  await phaseAuditLog.create(
    {
      cycleId,
      phaseName,
      action: PhaseAuditAction.ENDED,
      triggeredByEmpUuid,
    },
    { transaction },
  );
  return cycle;
};

/** Announce winners (admin). Replaces any existing winners for this cycle. */
export const announceWinners = async (
  cycleId: string,
  employeeChoiceEmpUuid: string,
  leadershipChoiceEmpUuid: string,
  announcedByEmpUuid: string,
  transaction?: Transaction,
) => {
  const run = async (t: Transaction) => {
    const cycle = await rewardCycle.findByPk(cycleId, { transaction: t });
    if (!cycle) throw new Error("Cycle not found.");

    const [employeeVoteCounts, leadershipVoteCounts] = await Promise.all([
      getVoteCountsForCycle(cycleId, {
        voteCategory: AwardType.EMPLOYEE_CHOICE,
      }),
      getVoteCountsForCycle(cycleId, {
        voteCategory: AwardType.LEADERSHIP_CHOICE,
      }),
    ]);
    const countMapEmployee = new Map(
      employeeVoteCounts.map((c) => [c.nomineeEmpUuid, c.voteCount]),
    );
    const countMapLeadership = new Map(
      leadershipVoteCounts.map((c) => [c.nomineeEmpUuid, c.voteCount]),
    );

    const getCitation = async (nomineeEmpUuid: string) => {
      const g = await groupedCitation.findOne({
        where: { cycleId, nomineeEmpUuid },
        transaction: t,
      });
      if (g) return g.groupedCitation;
      const noms = await nomination.findAll({
        where: { cycleId, nomineeEmpUuid, isRemoved: false },
        transaction: t,
      });
      return noms.map((n) => n.citation).join("\n\n");
    };

    const now = new Date();
    const [citation1, citation2] = await Promise.all([
      getCitation(employeeChoiceEmpUuid),
      getCitation(leadershipChoiceEmpUuid),
    ]);

    await winner.destroy({ where: { cycleId }, transaction: t });
    await winner.bulkCreate(
      [
        {
          cycleId,
          employeeEmpUuid: employeeChoiceEmpUuid,
          awardType: AwardType.EMPLOYEE_CHOICE,
          voteCount: countMapEmployee.get(employeeChoiceEmpUuid) ?? 0,
          finalCitation: citation1,
          announcedAt: now,
          announcedByEmpUuid,
        },
        {
          cycleId,
          employeeEmpUuid: leadershipChoiceEmpUuid,
          awardType: AwardType.LEADERSHIP_CHOICE,
          voteCount: countMapLeadership.get(leadershipChoiceEmpUuid) ?? 0,
          finalCitation: citation2,
          announcedAt: now,
          announcedByEmpUuid,
        },
      ],
      { transaction: t },
    );

    await cycle.update(
      {
        currentPhase: RewardCyclePhase.WINNERS,
        status: RewardCycleStatus.COMPLETED,
        winnersAnnouncedDate: now,
      },
      { transaction: t },
    );

    await phaseAuditLog.create(
      {
        cycleId,
        phaseName: PhaseAuditPhaseName.WINNERS,
        action: PhaseAuditAction.STARTED,
        triggeredByEmpUuid: announcedByEmpUuid,
      },
      { transaction: t },
    );

    return getCycleById(cycleId, t);
  };

  if (transaction) {
    return run(transaction);
  }
  return dbOutput.sequelize.transaction(run);
};

/** End phase without winners (no nominees case). Marks cycle as completed without creating winner records. */
export const endPhaseWithoutWinners = async (
  cycleId: string,
  triggeredByEmpUuid: string,
  transaction?: Transaction,
) => {
  const run = async (t: Transaction) => {
    const cycle = await rewardCycle.findByPk(cycleId, { transaction: t });
    if (!cycle) throw new Error("Cycle not found.");

    const now = new Date();

    // Delete any existing winners (in case there are partial records)
    await winner.destroy({ where: { cycleId }, transaction: t });

    await cycle.update(
      {
        currentPhase: RewardCyclePhase.WINNERS,
        status: RewardCycleStatus.COMPLETED,
        winnersAnnouncedDate: now,
      },
      { transaction: t },
    );

    await phaseAuditLog.create(
      {
        cycleId,
        phaseName: PhaseAuditPhaseName.WINNERS,
        action: PhaseAuditAction.STARTED,
        triggeredByEmpUuid,
      },
      { transaction: t },
    );

    return getCycleById(cycleId, t);
  };

  if (transaction) {
    return run(transaction);
  }
  return dbOutput.sequelize.transaction(run);
};

/** Get nominees with vote count for Announce Winners modal. Returns employee-choice and leadership-choice vote counts per nominee. */
export const getNomineesWithVoteCountForAnnounce = async (cycleId: string) => {
  const nomineesWithCitation = await getNominationsForCycle(cycleId, {
    forVoting: true,
  });
  const [employeeVoteCounts, leadershipVoteCounts] = await Promise.all([
    getVoteCountsForCycle(cycleId, { voteCategory: AwardType.EMPLOYEE_CHOICE }),
    getVoteCountsForCycle(cycleId, {
      voteCategory: AwardType.LEADERSHIP_CHOICE,
    }),
  ]);
  const countMapEmployee = new Map(
    employeeVoteCounts.map((c) => [c.nomineeEmpUuid, c.voteCount]),
  );
  const countMapLeadership = new Map(
    leadershipVoteCounts.map((c) => [c.nomineeEmpUuid, c.voteCount]),
  );

  interface NomineeForAnnounce {
    nomineeEmpUuid: string;
    nominee?: unknown;
    citationDisplay: string;
  }
  const empUuids = nomineesWithCitation.map(
    (n: NomineeForAnnounce) => n.nomineeEmpUuid,
  );
  const jobs = await employeeJobDetails.findAll({
    where: { empUuid: { [Op.in]: empUuids }, isDeleted: false },
    attributes: ["empUuid", "empDepartment"],
  });
  const jobMap = new Map(
    (jobs as { empUuid: string; empDepartment: string }[]).map((j) => [
      j.empUuid,
      j.empDepartment,
    ]),
  );

  return nomineesWithCitation
    .map((n: NomineeForAnnounce) => ({
      nomineeEmpUuid: n.nomineeEmpUuid,
      nominee: n.nominee,
      voteCount:
        (countMapEmployee.get(n.nomineeEmpUuid) ?? 0) +
        (countMapLeadership.get(n.nomineeEmpUuid) ?? 0),
      voteCountEmployeeChoice: countMapEmployee.get(n.nomineeEmpUuid) ?? 0,
      voteCountLeadershipChoice: countMapLeadership.get(n.nomineeEmpUuid) ?? 0,
      department: jobMap.get(n.nomineeEmpUuid) ?? null,
      citationDisplay: n.citationDisplay,
    }))
    .sort(
      (a, b) =>
        b.voteCountEmployeeChoice +
        b.voteCountLeadershipChoice -
        (a.voteCountEmployeeChoice + a.voteCountLeadershipChoice),
    );
};

/** Get my citations for current cycle (for "View Citations" on dashboard) */
export const getMyCitationsForCycle = async (
  cycleId: string,
  empUuid: string,
) => {
  const noms = await nomination.findAll({
    where: { cycleId, nomineeEmpUuid: empUuid, isRemoved: false },
    include: [
      {
        model: employeeBasicDetails,
        as: "nominatedBy",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
    ],
  });
  interface NomWithNominatedBy {
    nominatedBy?: { empFirstName?: string; empLastName?: string } | null;
  }
  return noms.map((n) => {
    const plain = n.get({ plain: true }) as NomWithNominatedBy;
    const nb = plain.nominatedBy;
    const nominatedBy = nb
      ? `${nb.empFirstName || ""} ${nb.empLastName || ""}`.trim() || null
      : null;
    return { citation: n.citation, nominatedBy };
  });
};

/**
 * Get received citations across past completed cycles.
 * Only includes cycles where winners have been announced.
 */
export const getMyPastReceivedCitations = async (
  empUuid: string,
  year?: number,
) => {
  const noms = await nomination.findAll({
    where: { nomineeEmpUuid: empUuid, isRemoved: false },
    include: [
      {
        model: employeeBasicDetails,
        as: "nominatedBy",
        attributes: ["empUuid", "empFirstName", "empLastName"],
      },
      {
        model: rewardCycle,
        as: "cycle",
        attributes: ["id", "month", "year", "status", "winnersAnnouncedDate"],
        where: {
          ...(typeof year === "number" ? { year } : {}),
          status: RewardCycleStatus.COMPLETED,
          winnersAnnouncedDate: { [Op.ne]: null },
        },
        required: true,
      },
    ],
    order: [
      [{ model: rewardCycle, as: "cycle" }, "year", "DESC"],
      [{ model: rewardCycle, as: "cycle" }, "month", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  return noms.map((n) => n.get({ plain: true }));
};

/** Search employees (for nomination dropdown) */
export const searchEmployees = async (
  query: string,
  excludeEmpUuid: string,
  limit = 20,
) => {
  type WhereClause = { isDeleted: false; [Op.or]?: unknown[] };
  const where: WhereClause = { isDeleted: false };
  const q = query?.trim() ?? "";
  if (q) {
    const like = `%${q}%`;
    where[Op.or] = [
      { empFirstName: { [Op.like]: like } },
      { empLastName: { [Op.like]: like } },
      { empCompanyId: { [Op.like]: like } },
    ];
  }

  const employees = await employeeBasicDetails.findAll({
    where,
    attributes: ["empUuid", "empFirstName", "empLastName", "empCompanyId"],
    limit,
    include: [
      {
        model: employeeJobDetails,
        as: "jobDetails",
        required: false,
        where: { isDeleted: false },
        attributes: ["empDepartment"],
      },
    ],
  });

  return employees
    .filter((e) => e.empUuid !== excludeEmpUuid)
    .map((e) => {
      const plain = e.get({ plain: true }) as {
        jobDetails?: { empDepartment?: string } | null;
      };
      const department = plain.jobDetails?.empDepartment ?? null;
      return {
        empUuid: e.empUuid,
        empFirstName: e.empFirstName,
        empLastName: e.empLastName,
        empCompanyId: e.empCompanyId,
        department,
      };
    });
};
