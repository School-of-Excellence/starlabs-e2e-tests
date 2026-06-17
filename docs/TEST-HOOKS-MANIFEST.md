# Test-hooks manifest (extracted from starlabs-cicd before freeze) — 2026-06-17
_Every data-testid / data-* selector the e2e suite relies on, with its source element. Use to port into Starlabs 19 and verify placement._


## OpenVidu/join-openvidu-call/join-openvidu-call.component.html
- L19  `data-testid="joinroom-prejoin"`
- L68  `data-testid="joinroom-enable-btn"`
- L71  `data-testid="joinroom-join-btn"`
- L89  `data-testid="joinroom-connected"`

## big/atcmodel-level-config/atcmodel-level-config.component.html
- L12  `data-testid="modelconfig-add"`

## big/big-activity-log/big-activity-log.component.html
- L14  `data-testid="activitylog-export"`

## big/big-aggregate-event-level/big-aggregate-event-level.component.html
- L43  `data-testid="ael-submit"`
- L83  `data-testid="ael-total-count"`

## big/big-aggregate/big-aggregate.component.html
- L50  `data-testid="aggregate-submit"`
- L78  `data-testid="aggregate-total-count"`

## big/big-cohort-clone-2/big-cohort-clone-2.component.html
- L242  `data-testid="cohort-card"`
- L42  `data-testid="cohorts-create"`

## big/big-dashboard/big-dashboard.component.html
- L147  `data-testid="big-dash-cohort-card"`
- L156  `data-testid="big-dash-cohort-count"`
- L235  `data-testid="big-dash-total-count"`
- L236  `data-testid="big-dash-filtered-count"`
- L268  `data-testid="big-dash-cohorts-btn"`

## big/big-level/big-level.component.html
- L12  `data-testid="biglevel-add"`

## big/form-based-submission/form-based-submission.component.html
- L316  `data-testid="form-submit"`
- L351  `data-testid="form-rework"`
- L352  `data-testid="form-complete"`

## big/manual-assignments/manual-assignments.component.html
- L191  `data-testid="manual-rework"`
- L192  `data-testid="manual-submit"`
- L193  `data-testid="manual-complete"`
- L30  `data-testid="manual-file-input"`

## big/monitor-activity-log/monitor-activity-log.component.html
- L54  `data-testid="monitor-export"`

## big/participant-assignment-board/participant-assignment-board.component.html
- L236  `data-testid="pab-perform-action"`
- L33  `data-testid="pab-marathon-btn"`
- L35  `data-testid="pab-marathon-pending"`
- L47  `data-testid="pab-status-btn"`
- L53  `data-testid="pab-status-count"`
- L86  `data-testid="pab-card"`
- L88  `data-testid="pab-type-badge"`
- L98  `data-testid="pab-status-badge"`

## big/validate-participants-assignment/validate-participants-assignment.component.html
- L210  `data-testid="validate-col"`
- L218  `data-testid="validate-col-count"`
- L241  `data-testid="validate-bulk-move"`
- L24  `data-testid="validate-marathon-select"`
- L250  `data-testid="validate-move-to"`
- L286  `data-testid="validate-review"`
- L295  `data-testid="validate-single-move"`
- L302  `data-testid="validate-move-to"`
- L94  `data-testid="validate-assignment-item"`

## big/watch-videos/watch-videos.component.html
- L119  `data-testid="watchvideos-complete"`

## big/zoom-meeting/zoom-meeting.component.html
- L48  `data-testid="zoom-join"`

## queue system/accept-other-studio/accept-other-studio.component.html
- L5  `data-testid="aos-deny-btn"`
- L6  `data-testid="aos-accept-btn"`

## queue system/arenastudioactivity/arenastudioactivity.component.html
- L112  `data-testid="arena-close-studio-btn"`
- L135  `data-testid="arena-empty-state"`
- L28  `data-testid="arena-zoom-available-count"`
- L42  `data-testid="arena-participant-card"`
- L6  `data-testid="arena-queue-select"`

## queue system/assign-queue-studio/assign-queue-studio.component.html
- L46  `data-testid="aqs-submit"`
- L6  `data-testid="aqs-studio-select"`

## queue system/big-planner/big-planner.component.html
- L10  `data-testid="bp-viewonly-toggle"`
- L17  `data-testid="bp-event-select"`
- L393  `data-testid="bp-studio-toggle"`
- L429  `data-testid="bp-studio-row"`
- L55  `data-testid="bp-participant-row"`
- L93  `data-testid="bp-stat-studios"`
- L99  `data-testid="bp-stat-pair"`

## queue system/create-bulk-invitation/create-bulk-invitation.component.html
- L33  `data-testid="bulkinv-submit-btn"`
- L8  `data-testid="bulkinv-stage-select"`

## queue system/dynamic-queue-manager-clone/dynamic-queue-manager-clone.component.html
- L1017  `data-testid="qm-livequeue-btn"`
- L1062  `data-testid="qm-tag-chip"`
- L1189  `data-testid="qm-stage-count"`
- L1222  `data-testid="qm-move-btn"`
- L1240  `data-testid="qm-move-target"`
- L161  `data-testid="qm-comms-send"`
- L175  `data-testid="qm-comms-selectall"`
- L1839  `data-testid="qm-bulk-target"`
- L1879  `data-testid="qm-bulk-commit"`
- L378  `data-testid="qm-filters-clearall"`
- L446  `data-testid="qm-tag-option"`
- L45  `data-testid="qm-comms-recipient-count"`
- L825  `data-testid="qm-queue-select"`
- L837  `data-testid="qm-total-participants"`
- L868  `data-testid="qm-export-csv"`
- L884  `data-testid="qm-filters-open"`
- L886  `data-testid="qm-filter-badge"`

## queue system/dynamic-queue-manager-clone/dynamic-queue-manager-clone.component.ts
- L4930  `data-token-id="${reminder.profileid}"`
- L789  `data-stage-key="${match.tokenId}"`
- L791  `data-token-id="${match.tokenId}"`

## queue system/dynamic-studio/dynamic-studio.component.html
- L141  `data-testid="studio-stage-col"`
- L146  `data-testid="studio-token-card"`
- L159  `data-testid="studio-bring-btn"`
- L18  `data-testid="studio-queue-card"`
- L203  `data-testid="studio-live-participant-name"`
- L237  `data-testid="studio-zoom-start-btn"`
- L239  `data-testid="studio-zoom-regen-btn"`
- L23  `data-testid="studio-queue-card-count"`
- L252  `data-testid="studio-openvidu-start-btn"`
- L256  `data-testid="studio-invite-more-btn"`
- L286  `data-testid="studio-ael-validate-btn"`
- L47  `data-testid="studio-select-btn"`
- L4  `data-testid="studio-arena-title"`
- L500  `data-testid="studio-mark-procedure-btn"`
- L526  `data-testid="studio-move-next-btn"`
- L527  `data-testid="studio-move-next-btn"`
- L55  `data-testid="studio-live-tv-icon"`
- L59  `data-testid="studio-checkin-toggle"`
- L8  `data-testid="studio-no-studio-alert"`

## queue system/invite-other-studio/invite-other-studio.component.html
- L35  `data-testid="ios-cancel-btn"`
- L36  `data-testid="ios-invite-btn"`

## queue system/people-involved/people-involved.component.html
- L27  `data-testid="pi-submit"`
- L7  `data-testid="pi-person-select"`

## queue system/preassign-studio/preassign-studio.component.html
- L14  `data-testid="preassign-submit-btn"`
- L4  `data-testid="preassign-studio-radio"`

## queue system/queue-invitation-approval/queue-invitation-approval.component.html
- L30  `data-testid="qia-countdown"`
- L40  `data-testid="qia-cancel-btn"`

## web-studio-invitation/web-studio-invitation.component.html
- L2  `data-testid="web-inv-overlay"`
- L53  `data-testid="web-inv-accept-btn"`
- L57  `data-testid="web-inv-later-btn"`
- L89  `data-testid="web-inv-success-btn"`
