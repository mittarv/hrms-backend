import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import path from "path";
import { Transaction } from "sequelize";
import { EmailLog } from "../utilities/hrmsUtilities/dbCalls";

// HRMS-specific email transporter
const transporter = nodemailer.createTransport({
  service: "sendMail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
});

const handlebarOptions = {
  viewEngine: {
    extName: ".handlebars",
    partialsDir: path.resolve(__dirname, "../views"),
    defaultLayout: false,
  },
  viewPath: path.resolve(__dirname, "../views"),
  extName: ".handlebars",
};

transporter.use("compile", hbs(handlebarOptions));

const getBaseUrl = () => (process.env.HRMS_DASHBOARD_URL || "").replace(/\/$/, "");
const hrmsRedirectUrl = (path: string): string => {
  const base = getBaseUrl();
  if (!base) return "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

/**
 * Send onboarding email to new employee
 */
export const sendOnboardingEmail = async (
  email: string,
  employeeUuid: string,
  transaction?: Transaction,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        from: process.env.HRMS_SMTP_FROM,
        replyTo: process.env.HRMS_SMTP_FROM,
        to: email,
        subject: "Welcome Aboard!",
        template: "onboardingEmail",
        context: {
          redirectUrl: hrmsRedirectUrl("/dashboard"),
        },
      },
      async (err: Error | null) => {
        if (err) {
          console.log("Failed to send onboarding email:", err);
          reject(new Error(`Failed to send onboarding email: ${err.message}`));
        } else {
          console.log("Onboarding email sent successfully");
          try {
            await EmailLog(
              {
                recipient_employee_id: employeeUuid,
                recipient_email: email,
                sender_email: process.env.HRMS_SMTP_FROM || "",
                subject: "Welcome Aboard!",
              },
              transaction,
            );
            resolve("Email sent and logged successfully");
          } catch (logError) {
            console.log("Failed to create email log:", logError);
            const errorMessage =
              logError instanceof Error ? logError.message : String(logError);
            reject(new Error(`Failed to create email log: ${errorMessage}`));
          }
        }
      },
    );
  });
};

/**
 * Send employee personal details update notification to users with Employee Details permissions
 * (EmployeeDetailsRequest_write/read, ActiveEmployee_update/read).
 */
export const sendEmployeePersonalDetailsUpdateMail = async (
  users: Array<{ email: string; userId?: string }>,
  fullName: string,
  transaction?: Transaction,
): Promise<string> => {
  if (!process.env.HRMS_SMTP_FROM) {
    console.log("sendEmployeePersonalDetailsUpdateMail skipped: HRMS_SMTP_FROM not set");
    return Promise.resolve("Email skipped (SMTP not configured)");
  }
  if (!users || users.length === 0) {
    console.log("sendEmployeePersonalDetailsUpdateMail: no recipients, skipping");
    return Promise.resolve("No recipients");
  }
  console.log(`sendEmployeePersonalDetailsUpdateMail: sending to ${users.length} recipient(s)`);
  try {
    const emailPromises = users.map((user) => {
      return new Promise<string>((emailResolve, emailReject) => {
        transporter.sendMail(
          {
            from: process.env.HRMS_SMTP_FROM,
            replyTo: process.env.HRMS_SMTP_FROM,
            to: user.email,
            subject: "Employee Personal Details Updated",
            template: "employeePersonalDetailsUpdate",
            context: {
              employeeName: fullName,
              redirectUrl: hrmsRedirectUrl("hr-repo-requests"),
              subject: "Employee Personal Details Updated",
            },
          },
          async (err: Error | null) => {
            if (err) {
              console.log(
                `Failed to send personal details update email to ${user.email}:`,
                err,
              );
              emailReject(
                new Error(
                  `Failed to send email to ${user.email}: ${err.message}`,
                ),
              );
            } else {
              console.log(
                `Personal details update email sent successfully to ${user.email}`,
              );
              try {
                await EmailLog(
                  {
                    recipient_employee_id: user.userId,
                    recipient_email: user.email,
                    sender_email: process.env.HRMS_SMTP_FROM || "",
                    subject: "Employee Personal Details Updated",
                  },
                  transaction,
                );
                emailResolve(
                  `Email sent and logged successfully to ${user.email}`,
                );
              } catch (logError) {
                console.log(
                  `Failed to create email log for ${user.email}:`,
                  logError,
                );
                const errorMessage =
                  logError instanceof Error
                    ? logError.message
                    : String(logError);
                emailReject(
                  new Error(
                    `Failed to create email log for ${user.email}: ${errorMessage}`,
                  ),
                );
              }
            }
          },
        );
      });
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failureCount = results.filter(
      (result) => result.status === "rejected",
    ).length;

    console.log(
      `sendEmployeePersonalDetailsUpdateMail completed. Success: ${successCount}, Failures: ${failureCount}`,
    );

    if (failureCount > 0) {
      const failures = results.filter(
        (result) => result.status === "rejected",
      ) as PromiseRejectedResult[];
      console.error(
        "sendEmployeePersonalDetailsUpdateMail failed for:",
        failures.map((f) => f.reason?.message || f.reason),
      );
      // Do not throw - partial success is still success; caller gets result message
    }

    return successCount > 0
      ? `Sent ${successCount} of ${users.length} emails successfully`
      : `Failed to send all ${users.length} emails`;
  } catch (error) {
    console.log("Error in sendEmployeePersonalDetailsUpdateMail:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process email sending: ${errorMessage}`);
  }
};

/**
 * Send personal details approval notification to employee
 */
export const sendPersonalDetailsApprovedMail = async (
  email: string,
  employeeUuid: string,
  transaction?: Transaction,
  employeeName?: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        from: process.env.HRMS_SMTP_FROM,
        replyTo: process.env.HRMS_SMTP_FROM,
        to: email,
        subject: "Your Personal Details Update Request has been Approved",
        template: "personal_details_approved_requests",
        context: {
          redirectUrl: hrmsRedirectUrl("/hr-repo-requests"),
          employeeName: employeeName,
          subject: "Your Personal Details Update Request has been Approved",
        },
      },
      async (err: Error | null) => {
        if (err) {
          console.log("Failed to send Approval email:", err);
          reject(new Error(`Failed to send Approval email: ${err.message}`));
        } else {
          console.log("Approval email sent successfully");
          try {
            await EmailLog(
              {
                recipient_employee_id: employeeUuid,
                recipient_email: email,
                sender_email: process.env.HRMS_SMTP_FROM || "",
                subject:
                  "Your Personal Details Update Request has been Approved",
              },
              transaction,
            );
            resolve("Email sent and logged successfully");
          } catch (logError) {
            console.log("Failed to create email log:", logError);
            const errorMessage =
              logError instanceof Error ? logError.message : String(logError);
            reject(new Error(`Failed to create email log: ${errorMessage}`));
          }
        }
      },
    );
  });
};

/**
 * Send personal details rejection notification to employee
 */
export const sendPersonalDetailsRejectedMail = async (
  email: string,
  employeeUuid: string,
  transaction?: Transaction,
  employeeName?: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        from: process.env.HRMS_SMTP_FROM,
        replyTo: process.env.HRMS_SMTP_FROM,
        to: email,
        subject: "Your Personal Details Update Request has been Rejected",
        template: "personal_details_rejected_request",
        context: {
          redirectUrl: hrmsRedirectUrl("/hr-repo-requests"),
          employeeName: employeeName,
          subject: "Your Personal Details Update Request has been Rejected",
        },
      },
      async (err: Error | null) => {
        if (err) {
          console.log("Failed to send Rejection email:", err);
          reject(new Error(`Failed to send Rejection email: ${err.message}`));
        } else {
          console.log("Rejection email sent successfully");
          try {
            await EmailLog(
              {
                recipient_employee_id: employeeUuid,
                recipient_email: email,
                sender_email: process.env.HRMS_SMTP_FROM || "",
                subject:
                  "Your Personal Details Update Request has been Rejected",
              },
              transaction,
            );
            resolve("Email sent and logged successfully");
          } catch (logError) {
            console.log("Failed to create email log:", logError);
            const errorMessage =
              logError instanceof Error ? logError.message : String(logError);
            reject(new Error(`Failed to create email log: ${errorMessage}`));
          }
        }
      },
    );
  });
};

/**
 * Send leave request notification email to users with Leave Attendance permission
 * (LeaveAttendance_write or LeaveAttendanceAdmin_read).
 */
export const LeaveRequestMail = async (
  email: string,
  employeeUuid: string,
  employeeName: string,
  startDate: string,
  endDate: string | null,
  leaveType: string,
  autoApproval: boolean,
  transaction?: Transaction,
  isUpdate?: boolean,
  updatedBy?: string,
): Promise<string> => {
  if (!process.env.HRMS_SMTP_FROM) {
    console.log("LeaveRequestMail skipped: HRMS_SMTP_FROM not set");
    return Promise.resolve("Email skipped (SMTP not configured)");
  }
  const subject = isUpdate ? "Employee Leave Updated" : "Employee Applies for Leave";
  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        from: process.env.HRMS_SMTP_FROM,
        replyTo: process.env.HRMS_SMTP_FROM,
        to: email,
        subject,
        template: "employee_leave_approval",
        context: {
          redirectUrl: hrmsRedirectUrl("/hr-repo-requests"),
          employeeName: employeeName,
          subject,
          startDate: startDate,
          endDate: endDate,
          leaveType: leaveType,
          autoapproval: autoApproval,
          isUpdate: isUpdate || false,
          updatedBy: updatedBy || null,
        },
      },
      async (err: Error | null) => {
        if (err) {
          console.log("Failed to send Request for leave email:", err);
          reject(
            new Error(`Failed to send Request for leave email: ${err.message}`),
          );
        } else {
          console.log("Request for leave email sent successfully");
          try {
            await EmailLog(
              {
                recipient_employee_id: employeeUuid,
                recipient_email: email,
                sender_email: process.env.HRMS_SMTP_FROM || "",
                subject,
              },
              transaction,
            );
            resolve("Email sent and logged successfully");
          } catch (logError) {
            console.log("Failed to create email log:", logError);
            const errorMessage =
              logError instanceof Error ? logError.message : String(logError);
            reject(new Error(`Failed to create email log: ${errorMessage}`));
          }
        }
      },
    );
  });
};

/**
 * Fire-and-forget: send leave request mail to multiple recipients. Does not block.
 * Call this only after the API response has been sent. Never await this.
 */
export const sendLeaveRequestMailToRecipients = (
  recipients: Array<{ empUuid: string; empOfficialEmail: string }>,
  params: {
    employeeName: string;
    startDate: string;
    endDate: string | null;
    leaveType: string;
    autoApproval: boolean;
    isUpdate?: boolean;
    updatedBy?: string;
  },
): void => {
  for (const r of recipients) {
    if (!r.empOfficialEmail) continue;
    LeaveRequestMail(
      r.empOfficialEmail,
      r.empUuid,
      params.employeeName,
      params.startDate,
      params.endDate,
      params.leaveType,
      params.autoApproval,
      undefined,
      params.isUpdate,
      params.updatedBy,
    ).catch((err) => console.error("LeaveRequestMail error:", err));
  }
};

/**
 * Send leave request approve/reject notification email to employee
 */
export const apporveRejectLeaveRequestMail = async (
  email: string,
  employeeUuid: string,
  startDate: string,
  endDate: string | null,
  approved: boolean,
  transaction?: Transaction,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        from: process.env.HRMS_SMTP_FROM,
        replyTo: process.env.HRMS_SMTP_FROM,
        to: email,
        subject: "Leave application Status",
        template: "leave_request_status",
        context: {
          redirectUrl: hrmsRedirectUrl("/leave-attendance"),
          subject: "Leave application Status",
          startDate: startDate,
          endDate: endDate,
          status: approved,
        },
      },
      async (err: Error | null) => {
        if (err) {
          console.log("Failed to send Leave application status email:", err);
          reject(
            new Error(
              `Failed to send Leave application status email: ${err.message}`,
            ),
          );
        } else {
          console.log("Leave application status email sent successfully");
          try {
            await EmailLog(
              {
                recipient_employee_id: employeeUuid,
                recipient_email: email,
                sender_email: process.env.HRMS_SMTP_FROM || "",
                subject: "Leave application Status",
              },
              transaction,
            );
            resolve("Email sent and logged successfully");
          } catch (logError) {
            console.log("Failed to create email log:", logError);
            const errorMessage =
              logError instanceof Error ? logError.message : String(logError);
            reject(new Error(`Failed to create email log: ${errorMessage}`));
          }
        }
      },
    );
  });
};

/**
 * Send offboarding clearance notification email to userType>=500 users
 * Template: "Notification for clearance" — HR and Finance clearance required
 */
export const sendOffboardingClearanceEmail = async (
  users: Array<{ email: string; userId?: string }>,
  employeeName: string,
): Promise<void> => {
  try {
    const emailPromises = users.map((user) => {
      return new Promise<string>((emailResolve, emailReject) => {
        transporter.sendMail(
          {
            from: process.env.HRMS_SMTP_FROM,
            replyTo: process.env.HRMS_SMTP_FROM,
            to: user.email,
            subject: `Offboarding initiated for ${employeeName}`,
            template: "offboardingClearanceNotification",
            context: {
              employeeName: employeeName,
              redirectUrl: hrmsRedirectUrl("/employee-repo"),
            },
          },
          async (err: Error | null) => {
            if (err) {
              console.log(
                `Failed to send offboarding clearance email to ${user.email}:`,
                err,
              );
              emailReject(
                new Error(
                  `Failed to send email to ${user.email}: ${err.message}`,
                ),
              );
            } else {
              console.log(
                `Offboarding clearance email sent successfully to ${user.email}`,
              );
              try {
                await EmailLog({
                  recipient_employee_id: user.userId,
                  recipient_email: user.email,
                  sender_email: process.env.HRMS_SMTP_FROM || "",
                  subject: `Offboarding initiated for ${employeeName}`,
                });
                emailResolve(
                  `Email sent and logged successfully to ${user.email}`,
                );
              } catch (logError) {
                console.log(
                  `Failed to create email log for ${user.email}:`,
                  logError,
                );
                const errorMessage =
                  logError instanceof Error
                    ? logError.message
                    : String(logError);
                emailReject(
                  new Error(
                    `Failed to create email log for ${user.email}: ${errorMessage}`,
                  ),
                );
              }
            }
          },
        );
      });
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failureCount = results.filter(
      (result) => result.status === "rejected",
    ).length;
    console.log(
      `Offboarding clearance emails completed. Success: ${successCount}, Failures: ${failureCount}`,
    );
  } catch (error) {
    console.log("Error in sendOffboardingClearanceEmail:", error);
  }
};

/**
 * Send offboarding manager notification email to userType>=500 users
 * Template: "Manager Offboarding Pending" — employee is a manager, reporting lines need updating
 */
export const sendOffboardingManagerEmail = async (
  users: Array<{ email: string; userId?: string }>,
  employeeName: string,
): Promise<void> => {
  try {
    const emailPromises = users.map((user) => {
      return new Promise<string>((emailResolve, emailReject) => {
        transporter.sendMail(
          {
            from: process.env.HRMS_SMTP_FROM,
            replyTo: process.env.HRMS_SMTP_FROM,
            to: user.email,
            subject: `Manager Offboarding Pending - ${employeeName}`,
            template: "offboardingManagerNotification",
            context: {
              employeeName: employeeName,
              redirectUrl: hrmsRedirectUrl("/employee-repo"),
            },
          },
          async (err: Error | null) => {
            if (err) {
              console.log(
                `Failed to send offboarding manager email to ${user.email}:`,
                err,
              );
              emailReject(
                new Error(
                  `Failed to send email to ${user.email}: ${err.message}`,
                ),
              );
            } else {
              console.log(
                `Offboarding manager email sent successfully to ${user.email}`,
              );
              try {
                await EmailLog({
                  recipient_employee_id: user.userId,
                  recipient_email: user.email,
                  sender_email: process.env.HRMS_SMTP_FROM || "",
                  subject: `Manager Offboarding Pending - ${employeeName}`,
                });
                emailResolve(
                  `Email sent and logged successfully to ${user.email}`,
                );
              } catch (logError) {
                console.log(
                  `Failed to create email log for ${user.email}:`,
                  logError,
                );
                const errorMessage =
                  logError instanceof Error
                    ? logError.message
                    : String(logError);
                emailReject(
                  new Error(
                    `Failed to create email log for ${user.email}: ${errorMessage}`,
                  ),
                );
              }
            }
          },
        );
      });
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failureCount = results.filter(
      (result) => result.status === "rejected",
    ).length;
    console.log(
      `Offboarding manager emails completed. Success: ${successCount}, Failures: ${failureCount}`,
    );
  } catch (error) {
    console.log("Error in sendOffboardingManagerEmail:", error);
  }
};

/**
 * Options for rewards notification email (e.g. Nominations started)
 * illustrationHtml: optional raw HTML (e.g. inline SVG). Rendered with triple braces in Handlebars so it is not escaped. Use xmlns on SVG, href (not xlink:href) for <use>. If omitted, template uses PNG image.
 */
export type SendRewardsEmailOptions = {
  subject: string;
  monthYear: string;
  redirectUrl: string;
  illustrationHtml?: string;
};

/**
 * Send Rewards & Recognition notification email using HTML template (e.g. Nominations started)
 */
export const sendRewardsEmail = async (
  toEmail: string,
  options: SendRewardsEmailOptions,
): Promise<void> => {
  const { subject, monthYear, redirectUrl, illustrationHtml } = options;
  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        from: process.env.HRMS_SMTP_FROM,
        replyTo: process.env.HRMS_SMTP_FROM,
        to: toEmail,
        subject,
        template: "rewardsNominationsStarted",
        context: {
          subject,
          monthYear,
          redirectUrl: redirectUrl || process.env.HRMS_DASHBOARD_URL || "",
          ...(illustrationHtml !== undefined && { illustrationHtml }),
        },
      },
      (err: Error | null) => {
        if (err) {
          console.error("Rewards email failed:", toEmail, err);
          reject(err);
        } else {
          console.log("Rewards email sent successfully to:", toEmail);
          resolve();
        }
      },
    );
  });
};
