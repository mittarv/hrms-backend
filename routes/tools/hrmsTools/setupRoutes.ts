import { Router } from "express";
import { autoCompleteHrmsSetup, getOrganizationDetails, updateOrganizationDetails } from "../../../controllers/tools/hrmsTools/setup/hrmsSetupController";
import { isTmsUserAuthenticated } from "../../../middlewares/isAuthenticated";
import { tenantMiddleware } from "../../../middlewares/tenantMiddleware";

const router = Router();

router.get("/organization", isTmsUserAuthenticated, tenantMiddleware, getOrganizationDetails);
router.put("/organization", isTmsUserAuthenticated, tenantMiddleware, updateOrganizationDetails);


router.post("/autoCompleteSetup", isTmsUserAuthenticated, tenantMiddleware, autoCompleteHrmsSetup);

export default router;
