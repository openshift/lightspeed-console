# User Feedback

Users can provide feedback on AI responses to help improve the service.
Feedback is submitted to the OLS backend service and may be forwarded via
the Insights telemetry pipeline.

## Behavioral Rules

### Feedback Status

1. On plugin initialization, the plugin must check whether feedback
   collection is enabled by calling the feedback status endpoint. If the
   endpoint returns `enabled: false`, the plugin must disable all feedback
   UI for the session.

2. If the feedback status check fails, feedback must remain enabled
   (optimistic default). The error must be logged to the console.

3. The feedback enabled/disabled state is stored in Redux and affects all
   responses in the session.

### Feedback Actions

4. When feedback is enabled, each AI response (except those with errors)
   must show thumbs-up and thumbs-down action buttons.

5. Clicking thumbs-up or thumbs-down must:
   a. Open the feedback form for that specific response.
   b. Record the sentiment (positive = 1, negative = -1).

6. The feedback form must include:
   - A privacy disclaimer warning users not to include personal or
     sensitive information.
   - An optional free-text area for detailed feedback.
   - A submit button.
   - A close button.

7. The sentiment and free-text values must be persisted in Redux state per
   response entry. If the user closes and reopens the popover, previously
   entered feedback must still be present.

### Feedback Submission

8. On submit, the plugin must POST to the feedback endpoint with:
   `conversation_id`, `user_question` (including serialized attachments if
   any), `llm_response`, `sentiment` (1 or -1), and `user_feedback`
   (free-text, empty string if not provided).

9. On success, a "feedback submitted" confirmation must replace the form.

10. On failure, an error alert must be displayed. The form must remain
    accessible for retry.

11. The feedback submission has a request timeout.

### Privacy Notice

12. A static privacy notice must be displayed in the chat welcome area at
    all times, informing users that AI technology is used and that
    interactions may improve Red Hat's products.

13. Each feedback form must include a privacy warning about not including
    personal or sensitive information.

### Copy Response

14. Each AI response (except those with errors) must include a copy action
    that copies the response text to the clipboard.

## Constraints

1. Feedback state is per-response, not per-conversation. Users can submit
   feedback on individual responses independently.

2. Feedback is submitted once per response. After successful submission,
   the form shows a confirmation and cannot be resubmitted.

3. Feedback is not stored locally. It is sent to the OLS service which
   handles persistence and telemetry forwarding.
