const nodemailer = require('nodemailer');
var hbs = require('nodemailer-express-handlebars');
const path = require('path')
const util = require('util');
import {EmailLog} from '../utilities/hrmsUtilities/dbCalls';

var transporter = nodemailer.createTransport({
  service: "sendMail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
});


const handlebarOptions = {
  viewEngine: {
    extName: ".handlebars",
    partialsDir: path.resolve(__dirname, '../views'),
    defaultLayout: false,
  },
  viewPath: path.resolve(__dirname, '../views'),
  extName: ".handlebars",
}

transporter.use('compile', hbs(handlebarOptions));

export const sendOnboardingEmail = async (email, employeeUuid, transaction) => {
  return new Promise((resolve, reject) => {
    transporter.sendMail({
      from: process.env.HRMS_SMTP_FROM,
      replyTo: process.env.HRMS_SMTP_FROM,
      to: email,
      subject: 'Welcome Aboard!',
      template: 'onboardingEmail',
      context: {
        redirectUrl: process.env.HRMS_DASHBOARD_URL,
      }
    }, async (err) => {
      if (err) {
        console.log('Failed to send onboarding email:', err);
        reject(new Error(`Failed to send onboarding email: ${err.message}`));
      } else {
        console.log("Onboarding email sent successfully");
        
        // Log the email sending event
        try {
          await EmailLog({
            recipient_employee_id: employeeUuid || null,
            recipient_email: email,
            sender_email: process.env.HRMS_SMTP_FROM,
            subject: 'Welcome Aboard!',
            transaction: transaction
          });
          resolve('Email sent and logged successfully');
        } catch (logError) {
          console.log('Failed to create email log:', logError);
          reject(new Error(`Failed to create email log: ${logError.message}`));
        }
      }
    });
  });
};


export const sendEmployeePersonalDetailsUpdateMail = async (users, fullName, transaction) => {
  try {
    const emailPromises = users.map(user => {
      return new Promise((emailResolve, emailReject) => {
        transporter.sendMail({
          from: process.env.HRMS_SMTP_FROM,
          replyTo: process.env.HRMS_SMTP_FROM,
          to: user.email,
          subject: 'Employee Personal Details Updated',
          template: 'employeePersonalDetailsUpdate',
          context: {
            employeeName: fullName,
            redirectUrl: process.env.HRMS_DASHBOARD_URL,
            subject: 'Employee Personal Details Updated',
          }
        }, async (err) => {
          if (err) {
            console.log(`Failed to send personal details update email to ${user.email}:`, err);
            emailReject(new Error(`Failed to send email to ${user.email}: ${err.message}`));
          } else {
            console.log(`Personal details update email sent successfully to ${user.email}`);
            
            // Log the email sending event
            try {
              await EmailLog({
                recipient_employee_id: user.userId || null,
                recipient_email: user.email,
                sender_email: process.env.HRMS_SMTP_FROM,
                subject: 'Employee Personal Details Updated',
                transaction: transaction
              });
              emailResolve(`Email sent and logged successfully to ${user.email}`);
            } catch (logError) {
              console.log(`Failed to create email log for ${user.email}:`, logError);
              emailReject(new Error(`Failed to create email log for ${user.email}: ${logError.message}`));
            }
          }
        });
      });
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.filter(result => result.status === 'rejected').length;
    
    console.log(`Email sending completed. Success: ${successCount}, Failures: ${failureCount}`);
    
    if (failureCount > 0) {
      const failures = results.filter(result => result.status === 'rejected');
      console.log('Failed emails:', failures.map(f => f.reason.message));
      throw new Error(`Failed to send ${failureCount} out of ${users.length} emails`);
    }
    
    return `All ${successCount} emails sent and logged successfully`;
  } catch (error) {
    console.log('Error in sendEmployeePersonalDetailsUpdateMail:', error);
    throw new Error(`Failed to process email sending: ${error.message}`);
  }
};

export const sendPersonalDetailsApprovedMail = async (email, employeeUuid, transaction, employeeName) => {
 return new Promise((resolve, reject) => {
    transporter.sendMail({
      from: process.env.HRMS_SMTP_FROM,
      replyTo: process.env.HRMS_SMTP_FROM,
      to: email,
      subject: 'Your Personal Details Update Request has been Approved',
      template: 'personal_details_approved_requests',
      context: {
        redirectUrl: process.env.HRMS_DASHBOARD_URL,
        employeeName: employeeName,
        subject: 'Your Personal Details Update Request has been Approved',
      }
    }, async (err) => {
      if (err) {
        console.log('Failed to send Approval email:', err);
        reject(new Error(`Failed to send Approval email: ${err.message}`));
      } else {
        console.log("Approval email sent successfully");

        // Log the email sending event
        try {
          await EmailLog({
            recipient_employee_id: employeeUuid || null,
            recipient_email: email,
            sender_email: process.env.HRMS_SMTP_FROM,
            subject: 'Your Personal Details Update Request has been Approved',
            transaction: transaction
          });
          resolve('Email sent and logged successfully');
        } catch (logError) {
          console.log('Failed to create email log:', logError);
          reject(new Error(`Failed to create email log: ${logError.message}`));
        }
      }
    });
  });
};


export const sendPersonalDetailsRejectedMail = async (email, employeeUuid, transaction, employeeName) => {
 return new Promise((resolve, reject) => {
    transporter.sendMail({
      from: process.env.HRMS_SMTP_FROM,
      replyTo: process.env.HRMS_SMTP_FROM,
      to: email,
      subject: 'Your Personal Details Update Request has been Rejected',
      template: 'personal_details_rejected_request',
      context: {
        redirectUrl: process.env.HRMS_DASHBOARD_URL,
        employeeName: employeeName,
        subject: 'Your Personal Details Update Request has been Rejected',
      }
    }, async (err) => {
      if (err) {
        console.log('Failed to send Rejection email:', err);
        reject(new Error(`Failed to send Rejection email: ${err.message}`));
      } else {
        console.log("Rejection email sent successfully");

        // Log the email sending event
        try {
          await EmailLog({
            recipient_employee_id: employeeUuid || null,
            recipient_email: email,
            sender_email: process.env.HRMS_SMTP_FROM,
            subject: 'Your Personal Details Update Request has been Rejected',
            transaction: transaction
          });
          resolve('Email sent and logged successfully');
        } catch (logError) {
          console.log('Failed to create email log:', logError);
          reject(new Error(`Failed to create email log: ${logError.message}`));
        }
      }
    });
  });
};

export const LeaveRequestMail = async (email, employeeUuid, employeeName, startDate, endDate, leaveType, autoApproval, transaction) => {
 return new Promise((resolve, reject) => {
    transporter.sendMail({
      from: process.env.HRMS_SMTP_FROM,
      replyTo: process.env.HRMS_SMTP_FROM,
      to: email,
      subject: 'Employee Applies for Leave',
      template: 'employee_leave_approval',
      context: {
        redirectUrl: process.env.HRMS_DASHBOARD_URL,
        employeeName: employeeName,
        subject: 'Employee Applies for Leave',
        startDate: startDate,
        endDate: endDate,
        leaveType: leaveType,
        autoapproval: autoApproval
      }
    }, async (err) => {
      if (err) {
        console.log('Failed to send Request for leave email:', err);
        reject(new Error(`Failed to send Request for leave email: ${err.message}`));
      } else {
        console.log("Request for leave email sent successfully");

        // Log the email sending event
        try {
          await EmailLog({
            recipient_employee_id: employeeUuid || null,
            recipient_email: email,
            sender_email: process.env.HRMS_SMTP_FROM,
            subject: 'Employee Applies for Leave',
            transaction: transaction
          });
          resolve('Email sent and logged successfully');
        } catch (logError) {
          console.log('Failed to create email log:', logError);
          reject(new Error(`Failed to create email log: ${logError.message}`));
        }
      }
    });
  });
};

export const apporveRejectLeaveRequestMail = async (email, employeeUuid, startDate, endDate, approved, transaction) => {
 return new Promise((resolve, reject) => {
    transporter.sendMail({
      from: process.env.HRMS_SMTP_FROM,
      replyTo: process.env.HRMS_SMTP_FROM,
      to: email,
      subject: 'Leave application Status',
      template: 'leave_request_status',
      context: {
        subject: 'Leave application Status',
        startDate: startDate,
        endDate: endDate,
        status: approved
      }
    }, async (err) => {
      if (err) {
        console.log('Failed to send Leave application status email:', err);
        reject(new Error(`Failed to send Leave application status email: ${err.message}`));
      } else {
        console.log("Leave application status email sent successfully");

        // Log the email sending event
        try {
          await EmailLog({
            recipient_employee_id: employeeUuid || null,
            recipient_email: email,
            sender_email: process.env.HRMS_SMTP_FROM,
            subject: 'Leave application Status',
            transaction: transaction
          });
          resolve('Email sent and logged successfully');
        } catch (logError) {
          console.log('Failed to create email log:', logError);
          reject(new Error(`Failed to create email log: ${logError.message}`));
        }
      }
    });
  });
}

export const sendSaaSCreationEmail = async (email, subdomain, domain, transaction) => {
  return new Promise((resolve, reject) => {
    // Construct redirect URL
    const isLocal = process.env.NODE_ENV !== 'production' || !domain.includes('.') || domain.includes('localhost') || domain.includes('lvh.me');
    
    let redirectUrl;
    if (isLocal) {
      // For local development, use localhost with tenant parameter
      redirectUrl = `http://localhost:3000/login?tenant=${subdomain}`;
    } else {
      // For production: use real subdomain routing (e.g. mittarv.extindia.com/app/hr)
      redirectUrl = `https://${subdomain}.${domain}/app/hr`;
    }

    transporter.sendMail({
      from: process.env.HRMS_SMTP_FROM,
      replyTo: process.env.HRMS_SMTP_FROM,
      to: email,
      subject: 'Welcome to your new HRMS',
      template: 'saas_onboarding_welcome',
      context: {
        redirectUrl: redirectUrl,
      }
    }, async (err) => {
      if (err) {
        console.log('Failed to send SaaS Creation email:', err);
        reject(new Error(`Failed to send SaaS Creation email: ${err.message}`));
      } else {
        console.log("SaaS Creation email sent successfully");

        // Log the email sending event
        try {
          await EmailLog({
            recipient_email: email,
            sender_email: process.env.HRMS_SMTP_FROM,
            subject: 'Welcome to your new HRMS',
            transaction: transaction
          });
          resolve('Email sent and logged successfully');
        } catch (logError) {
          console.log('Failed to create email log:', logError);
          // resolve anyway so the flow doesn't break if logging fails
          resolve('Email sent but log failed'); 
        }
      }
    });
  });
};