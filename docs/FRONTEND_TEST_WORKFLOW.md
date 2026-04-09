# Frontend Functional Test Runbook

This runbook tests each feature step-by-step to verify business logic, not only build quality.
Run in order from Section 0 to Section 9.

## 0. Setup and test data

Prepare this before testing:

1. Backend health check returns 200:

   curl -I https://api.huyhoang05.id.vn/health

2. CORS allows frontend origin:

   curl -I -H "Origin: http://localhost:5173" https://api.huyhoang05.id.vn/health

3. Frontend env points to production API:

   VITE_API_BASE_URL=https://api.huyhoang05.id.vn/api/v1

4. Start frontend:

   npm run dev

5. Create 3 accounts for role testing:
   - owner account
   - editor account
   - viewer account

## 1. Static quality gate (must pass first)

1. Open frontend folder.
2. Run:

   npm run check

Expected result:

1. Lint passes with no error.
2. Build succeeds.
3. If this fails, stop and fix before continuing.

## 2. Auth flow (register, login, session, logout)

### 2.1 Register validation

1. Open /register.
2. Submit empty form.
3. Submit invalid email.
4. Submit weak password (for example: only lowercase).

Expected result:

1. Form shows validation messages.
2. No request is accepted with invalid data.

### 2.2 Register success

1. Fill valid name, email, strong password.
2. Click Create Account.

Expected result:

1. User is redirected to /workspaces.
2. Header shows user name/email.

### 2.3 Logout

1. Click Logout in top right.

Expected result:

1. App redirects to /login.
2. Protected routes are no longer accessible without login.

### 2.4 Login and session persistence

1. Login with created account.
2. Refresh browser at /workspaces.
3. Open /profile directly.

Expected result:

1. Session remains valid after refresh.
2. User stays logged in and data loads.

## 3. Workspace management flow

### 3.1 Create workspace

1. In Workspaces page, enter Workspace Name and Icon.
2. Click Create Workspace.

Expected result:

1. New workspace card appears.
2. Card shows name, icon, and created date.

### 3.2 Rename workspace

1. Click Rename on that card.
2. Change name and click Save.

Expected result:

1. Name updates immediately.
2. Reload page and verify new name persists.

### 3.3 Open detail

1. Click Open on workspace card.

Expected result:

1. Route changes to /workspaces/:workspaceId.
2. Workspace title is shown.

### 3.4 Delete workspace

1. Return to /workspaces.
2. Click Delete on a test workspace.
3. Confirm browser confirmation dialog.

Expected result:

1. Workspace disappears from list.
2. Deleted workspace is gone after refresh.

## 4. Workspace detail flow (pages, members, search)

### 4.1 Create page

1. Open workspace detail.
2. In Pages card, enter Title and Icon.
3. Click Create Page.

Expected result:

1. New page appears in page tree.
2. Click page item and route goes to /pages/:pageId.

### 4.2 Member invite and role update

1. In Members card, input editor account email and role editor.
2. Click Invite.
3. Repeat for viewer account with role viewer.
4. Change role using role dropdown in table.
5. Click Remove for one member, then invite again.

Expected result:

1. Member list updates without full reload.
2. Role changes persist after refresh.
3. Remove action deletes member from table.

### 4.3 Search in workspace

1. Type at least 2 characters in Search input.
2. Click Search.
3. Click one result item.

Expected result:

1. Result list appears with title and snippet.
2. Click navigates to correct page.

## 5. Page detail flow (metadata, blocks, comments, upload, export, share)

### 5.1 Metadata update

1. Open a page.
2. Change Title and Icon in Page Metadata.
3. Click Save Metadata.
4. Refresh browser.

Expected result:

1. Updated title/icon remain after refresh.

### 5.2 Block CRUD

1. Select Block Type paragraph.
2. Enter content and click Add Block.
3. Edit block text in textarea.
4. Click Save Block.
5. Add one more block with another type.
6. Delete one block using Delete.

Expected result:

1. Added block appears in list.
2. Edited content persists after refresh.
3. Deleted block is removed and does not return.

### 5.3 Comment CRUD

1. Click Comments on one block.
2. Enter New Comment and click Add Comment.
3. Delete the comment using Remove.

Expected result:

1. Comment appears immediately after add.
2. Comment disappears immediately after delete.

### 5.4 Storage upload flow

1. Choose an image file using file input.
2. Click Upload Image.
3. Verify Uploaded key text appears.
4. Click Delete Uploaded.

Expected result:

1. Upload succeeds and object key is shown.
2. Delete succeeds and uploaded key is cleared.

### 5.5 Export markdown

1. Click Export Markdown.

Expected result:

1. Browser downloads a .md file.
2. File contains page content in markdown format.

### 5.6 Share link flow

1. Click Generate Share Link.
2. Click Copy.
3. Open copied URL in incognito window.

Expected result:

1. Shared page loads without login.
2. Blocks are readable on /share/:token route.

## 6. Realtime collaboration flow (2 users, 2 tabs)

Use owner and editor accounts in separate tabs or browsers.

1. Both users open same page.
2. Verify presence pills show both users.
3. User A adds or updates a block.
4. Verify User B sees update without manual refresh.
5. Close User B tab.

Expected result:

1. Presence list updates on join/leave.
2. Block updates sync across tabs.
3. No endless reconnect loop.

## 7. RBAC logic validation (owner/editor/viewer)

### 7.1 Owner

1. Login as owner.
2. Confirm owner can create page, invite members, update roles, remove members.

### 7.2 Editor

1. Login as editor.
2. Open same workspace.
3. Try page/block/comment actions.
4. Try restricted owner-level action if available.

Expected result:

1. Editor can edit content.
2. Restricted actions show proper forbidden handling.

### 7.3 Viewer

1. Login as viewer.
2. Open same workspace/page.
3. Try create/edit/delete page/block/comment.

Expected result:

1. Viewer cannot modify content.
2. UI does not crash and shows clear error feedback.

## 8. Cross-browser and responsive sanity

Run minimum checks on:

1. Chrome latest desktop.
2. Edge latest desktop.
3. Mobile viewport in devtools.

For each environment, quickly verify:

1. Login page layout.
2. Workspace list layout.
3. Page detail editor layout.
4. Share page readability.

Expected result:

1. No broken layout or unusable controls.

## 9. Pass/fail release criteria

Mark release as PASS only when all are true:

1. npm run check passes.
2. Sections 2 to 8 pass with no blocker bug.
3. Backend health endpoint is 200 during test window.

When a case fails, capture:

1. Feature and test section.
2. Exact steps to reproduce.
3. Expected vs actual result.
4. API endpoint and response.
5. Browser and timestamp.
