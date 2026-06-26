import express from "express";
import {
  getDashboard,
  getCurrentCycle,
  nominate,
  searchEmployees,
  getCycleNominations,
  getNomineesForVoting,
  getReviewNominees,
  vote,
  getMyCitationsForCycle,
  getMyReceivedCitationsHistory,
  getNomineesForAnnounce,
  startPhase,
  endPhase,
  removeNomination,
  getNomineeCitations,
  upsertGroupedCitation,
  announceWinners,
} from "../../../controllers/tools/hrmsTools/rewardsController";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";

const router = express.Router();

router.use(isTmsUserAuthenticated);

router.get("/dashboard", getDashboard);
router.get("/current-cycle", getCurrentCycle);
router.get("/employees/search", searchEmployees);

router.post("/nominate", nominate);
router.post("/vote", vote);

router.get("/cycles/:cycleId/nominations", getCycleNominations);
router.get("/cycles/:cycleId/nominees-for-voting", getNomineesForVoting);
router.get("/cycles/:cycleId/review-nominees", getReviewNominees);
router.get("/cycles/:cycleId/my-citations", getMyCitationsForCycle);
router.get("/my-received-citations-history", getMyReceivedCitationsHistory);

router.get("/cycles/:cycleId/nominees-for-announce", getNomineesForAnnounce);
router.get("/cycles/:cycleId/nominees/:nomineeEmpUuid/citations", getNomineeCitations);

router.post("/cycles/:cycleId/start-phase", startPhase);
router.post("/cycles/:cycleId/end-phase", endPhase);
router.post("/cycles/:cycleId/announce-winners", announceWinners);

router.put("/cycles/:cycleId/grouped-citation", upsertGroupedCitation);

router.post("/nominations/:nominationId/remove", removeNomination);

export default router;
