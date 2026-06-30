// HRMS Tools Routes
import { Application } from "express";
import employeeComponentConfiguratorRoutes from "./tools/hrmsTools/employeeComponentConfiguratorRoutes";
import employeeDetailsRoutes from "./tools/hrmsTools/employeeDetailsRoutes";
import employeeLeaveConfiguratorRoutes from "./tools/hrmsTools/employeeLeaveConfiguratorRoutes";
import employeeHolidayRoutes from "./tools/hrmsTools/employeeHolidayRoutes";
import employeeAttendanceRoutes from "./tools/hrmsTools/employeeAttendanceRoutes";
import employeeNotificationsRoutes from "./tools/hrmsTools/employeeNotificationsRoutes";
import salaryConfiguratorRoutes from "./tools/hrmsTools/salaryConfiguratorRoutes"
import PayrollRoutes from "./tools/hrmsTools/PayrollRoutes";
import hrmsAccessRoutes from "./tools/hrmsTools/hrmsAccessRoutes";
import importantlinkAndPolicyRoutes from "./tools/hrRepository/importantLinkAndPolicyRoutes";
import tmsUsersRoutes from "./tools/tmsUsersRoutes";
import uamToolDetailsRoutes from "./tools/uam/uamToolDetailsRoutes";
import uamToolUsersRoutes from "./tools/uam/uamToolUsersRoutes";
import uamUserGroupRoutes from "./tools/uam/uamUserGroupRoutes";
import uamRequestRoutes from "./tools/uam/uamRequestRoutes";
import uamToolAccessRoute from "./tools/uam/uamToolsAccessManagement";
import allCountryRoutes from "./platform/allCountryRoutes";

import payrollLevelManagementRoutes from "./tools/hrmsTools/payrollLevelManagementRoutes";
import employeeOffboardingRoutes from "./tools/hrmsTools/employeeOffboardingRoutes";
import rewardsRoutes from "./tools/hrmsTools/rewardsRoutes";
import secondaryLocationRoutes from "./tools/hrmsTools/secondaryLocationRoutes";

//HRMS tool routes
export function registerHrms(app: Application) {
    app.use("/api/hrms/empConfig", employeeComponentConfiguratorRoutes);
    app.use("/api/hrms/empConfig", payrollLevelManagementRoutes);
    app.use("/api/hrms/empDetails", employeeDetailsRoutes);
    app.use("/api/hrms/leaveConfig", employeeLeaveConfiguratorRoutes);
    app.use("/api/hrms/empHoliday", employeeHolidayRoutes);
    app.use("/api/hrms/empAttendanceManagement", employeeAttendanceRoutes);
    app.use("/api/hrms/Notifications", employeeNotificationsRoutes);
    app.use("/api/hrms/salaryConfigurator", salaryConfiguratorRoutes);
    app.use("/api/hrms/payroll", PayrollRoutes);
    app.use("/api/hrms/access", hrmsAccessRoutes);
    app.use("/api/hrrepository", importantlinkAndPolicyRoutes);
    app.use("/api/hrms/employeeOffboarding", employeeOffboardingRoutes);
    app.use("/api/hrms/rewards", rewardsRoutes);
    app.use("/api/hrms/secondaryLocation", secondaryLocationRoutes);

    // UAM tool routes
    app.use("/api/tms/users", tmsUsersRoutes);
    app.use("/api/uam/tools", uamToolDetailsRoutes);
    app.use("/api/uam/tools/users", uamToolUsersRoutes);
    app.use("/api/uam/permissions", uamUserGroupRoutes);
    app.use("/api/uam/request", uamRequestRoutes);

    // tool acces route
    app.use("/api/tms/toolpermission", uamToolAccessRoute);

    // all country routes
    app.use("/api/platform/allCountries", allCountryRoutes);
}