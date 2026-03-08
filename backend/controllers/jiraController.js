const axios = require('axios');
const Task = require('../models/tasks');

exports.createJiraIssue = async (req, res) => {
    const { taskId, summary, description, priority, assigneeEmail } = req.body;

   
    const priorityMap = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
    const jiraPriority = priorityMap[priority?.toUpperCase()] || 'Medium';

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

      
        const jiraBaseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
        const email = process.env.JIRA_EMAIL;
        const apiToken = process.env.JIRA_API_TOKEN;
        const projectKey = process.env.JIRA_PROJECT_KEY;
        const defaultAccountId = process.env.JIRA_ACCOUNT_ID;

        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

     
        let targetAccountId = defaultAccountId;
        if (assigneeEmail) {
            try {
                console.log(`[Jira] Searching for accountId or user with email: ${assigneeEmail}`);
                const searchResponse = await axios.get(`${jiraBaseUrl}/rest/api/3/user/search`, {
                    headers,
                    params: { query: assigneeEmail }
                });

                if (searchResponse.data && searchResponse.data.length > 0) {
                    const matchedUser = searchResponse.data.find(u => u.emailAddress === assigneeEmail) || searchResponse.data[0];
                    targetAccountId = matchedUser.accountId;
                    console.log(`[Jira] Found Jira accountId ${targetAccountId} for email ${assigneeEmail}`);
                } else {
                    console.warn(`[Jira] No Jira user found for email ${assigneeEmail}. Falling back to default accountId.`);
                }
            } catch (searchError) {
                console.error("[Jira] Error searching for user by email:", searchError.response ? searchError.response.data : searchError.message);
            }
        }

        const jiraData = {
            fields: {
                project: { key: projectKey },
                summary: summary,
                description: {
                    type: "doc",
                    version: 1,
                    content: [
                        {
                            type: "paragraph",
                            content: [{ type: "text", text: description }]
                        }
                    ]
                },
                issuetype: { name: "Task" },
                priority: { name: jiraPriority },
                assignee: { accountId: targetAccountId }
            }
        };

        console.log("[Jira] Creating issue, assignee accountId:", targetAccountId);

        const response = await axios.post(`${jiraBaseUrl}/rest/api/3/issue`, jiraData, { headers });

        const jiraIssueKey = response.data.key;
        console.log("[Jira] Issue created:", jiraIssueKey);

        task.jiraId = jiraIssueKey;
        await task.save();

        res.status(201).json({ success: true, jiraId: jiraIssueKey });

    } catch (error) {
        console.error("[Jira] Integration Error:", error.response ? error.response.data : error.message);
        res.status(500).json({
            message: "Failed to create Jira issue",
            details: error.response ? error.response.data : error.message
        });
    }
};
