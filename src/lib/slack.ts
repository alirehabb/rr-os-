// Thin wrapper over Slack's Web API — no SDK needed for two endpoints.
export async function slackPostMessage(text: string, channel = process.env.SLACK_BRIEF_CHANNEL_ID) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "Slack API error");
  return data;
}

export async function slackAuthTest() {
  const res = await fetch("https://slack.com/api/auth.test", {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  return res.json();
}
