
import axios from 'axios';


export const prepareEmailData = ({ taskId, body, recipient, taskTitle, ccEmail }) => {
    return {
        to_email: recipient,
        cc_email: ccEmail,
        subject: `Regarding task: ${taskTitle || 'Task'}`,
        message: body,
        taskId,
        taskTitle,
    };
};


export const sendEmailToTask = async ({ taskId, body, recipient, taskTitle, ccEmail }) => {
    try {
        const emailData = prepareEmailData({ taskId, body, recipient, taskTitle, ccEmail });
        const response = await axios.post('/api/email/send', emailData);
        return {
            success: true,
            message: response.data.message || 'Email sent successfully!',
            to: emailData.to_email,
            cc: emailData.cc_email,
        };
    } catch (error) {
        console.error('[Email Service] email send failure:', error);
        return {
            success: false,
            message: error.message || 'Failed to send email',
            error,
        };
    }
};

export default {
    prepareEmailData,
    sendEmailToTask,
};
