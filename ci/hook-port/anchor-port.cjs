const fs = require('fs');
const ROOT = "/Users/m1/Documents/Angular Projects/Version 19/Starlabs 19/src/app/";
// [relativeFile, exactAnchorSubstring, stringToInsertAfterAnchor]
const E = [
 ["queue system/accept-other-studio/accept-other-studio.component.html", '(click)="cancel()"', ' data-testid="aos-deny-btn"'],
 ["queue system/accept-other-studio/accept-other-studio.component.html", '(click)="submit()"', ' data-testid="aos-accept-btn"'],
 ["queue system/assign-queue-studio/assign-queue-studio.component.html", 'formControlName="selectedstudio"', ' data-testid="aqs-studio-select"'],
 ["queue system/assign-queue-studio/assign-queue-studio.component.html", '[disabled]="activityForm.invalid"', ' data-testid="aqs-submit"'],
 ["queue system/create-bulk-invitation/create-bulk-invitation.component.html", 'formControlName="stage"', ' data-testid="bulkinv-stage-select"'],
 ["queue system/create-bulk-invitation/create-bulk-invitation.component.html", '[disabled]="invitationForm.invalid || loading"', ' data-testid="bulkinv-submit-btn"'],
 ["queue system/invite-other-studio/invite-other-studio.component.html", '(click)="cancel()"', ' data-testid="ios-cancel-btn"'],
 ["queue system/invite-other-studio/invite-other-studio.component.html", '[disabled]="!callReady"', ' data-testid="ios-invite-btn"'],
 ["queue system/people-involved/people-involved.component.html", 'formControlName="person"', ' data-testid="pi-person-select"'],
 ["queue system/people-involved/people-involved.component.html", 'class="btn btn-outline-success"', ' data-testid="pi-submit"'],
 ["queue system/preassign-studio/preassign-studio.component.html", '*ngFor="let option of studioList"', ' data-testid="preassign-studio-radio" [attr.data-studio-id]="option[\'docid\']"'],
 ["queue system/preassign-studio/preassign-studio.component.html", '[disabled]="selectedStudioid == null"', ' data-testid="preassign-submit-btn"'],
 ["queue system/queue-invitation-approval/queue-invitation-approval.component.html", '[class.warning]="expiryInSeconds <= 30"', ' data-testid="qia-countdown"'],
 ["queue system/queue-invitation-approval/queue-invitation-approval.component.html", '(click)="cancel()"', ' data-testid="qia-cancel-btn"'],
 ["queue system/arenastudioactivity/arenastudioactivity.component.html", '(selectionChange)="onQueueSelect($event.value)"', ' data-testid="arena-queue-select"'],
 ["queue system/arenastudioactivity/arenastudioactivity.component.html", 'class="count-badge"', ' data-testid="arena-zoom-available-count"'],
 ["queue system/arenastudioactivity/arenastudioactivity.component.html", '(click)="closeStudio(item)"', ' data-testid="arena-close-studio-btn"'],
 ["queue system/arenastudioactivity/arenastudioactivity.component.html", '*ngIf="!arenaparticipant?.length"', ' data-testid="arena-empty-state"'],
];
const byFile = {};
for (const e of E) (byFile[e[0]] = byFile[e[0]] || []).push(e);
let ok=0, skip=0, amb=0, miss=0;
for (const f in byFile) {
  const p = ROOT + f;
  let c = fs.readFileSync(p, 'utf8');
  for (const [, anchor, insert] of byFile[f]) {
    const tid = insert.match(/data-testid="[^"]+"/)[0];
    if (c.includes(tid)) { console.log("SKIP (exists) " + tid); skip++; continue; }
    const n = c.split(anchor).length - 1;
    if (n === 0) { console.log("MISS  " + tid + "   anchor not found: " + anchor); miss++; }
    else if (n > 1) { console.log("AMBIG (" + n + ") " + tid + "   anchor: " + anchor); amb++; }
    else { c = c.replace(anchor, anchor + insert); console.log("OK    " + tid); ok++; }
  }
  fs.writeFileSync(p, c);
}
console.log(`\n== OK ${ok} | SKIP ${skip} | AMBIG ${amb} | MISS ${miss} ==`);
