# Starlabs 19 ⟵ starlabs-cicd — App-code Diff Review
_Generated 2026-06-16. Choose per row: **merge** / **ignore (keep S19)** / **replace (take golden)**._
_LOC hint: if S19 ≥ golden, Starlabs 19 is usually the newer version → ignore._

## MODIFIED (exists in both, content differs)
| # | File | golden LOC | S19 LOC | Δ(S19-gold) | hint | CHOICE |
|---|------|-----------:|--------:|-----------:|------|--------|
| 1 | `src/app/ATC/edit-atc/edit-atc.component.css` | 617 | 638 | 21 | S19 newer→ignore |  |
| 2 | `src/app/ATC/edit-atc/edit-atc.component.html` | 523 | 531 | 8 | S19 newer→ignore |  |
| 3 | `src/app/ATC/edit-atc/edit-atc.component.ts` | 1506 | 1620 | 114 | S19 newer→ignore |  |
| 4 | `src/app/ATC/prescribe-atc/prescribe-atc.component.css` | 691 | 721 | 30 | S19 newer→ignore |  |
| 5 | `src/app/ATC/prescribe-atc/prescribe-atc.component.html` | 533 | 564 | 31 | S19 newer→ignore |  |
| 6 | `src/app/ATC/prescribe-atc/prescribe-atc.component.ts` | 2463 | 2585 | 122 | S19 newer→ignore |  |
| 7 | `src/app/ATC/view-participant-atc/view-participant-atc.component.css` | 533 | 402 | -131 | golden bigger→review |  |
| 8 | `src/app/ATC/view-participant-atc/view-participant-atc.component.html` | 206 | 205 | -1 | golden bigger→review |  |
| 9 | `src/app/ATC/view-participant-atc/view-participant-atc.component.ts` | 274 | 340 | 66 | S19 newer→ignore |  |
| 10 | `src/app/AppEngagement/notification-record/notification-record.component.css` | 742 | 828 | 86 | S19 newer→ignore |  |
| 11 | `src/app/AppEngagement/notification-record/notification-record.component.html` | 500 | 602 | 102 | S19 newer→ignore |  |
| 12 | `src/app/AppEngagement/notification-record/notification-record.component.ts` | 891 | 995 | 104 | S19 newer→ignore |  |
| 13 | `src/app/Events/Chat/chat-screen/chat-screen.component.css` | 2418 | 3587 | 1169 | S19 newer→ignore |  |
| 14 | `src/app/Events/Chat/chat-screen/chat-screen.component.html` | 605 | 1106 | 501 | S19 newer→ignore |  |
| 15 | `src/app/Events/Chat/chat-screen/chat-screen.component.ts` | 1330 | 1940 | 610 | S19 newer→ignore |  |
| 16 | `src/app/Events/first-timers-dashboard/first-timers-dashboard.component.html` | 567 | 584 | 17 | S19 newer→ignore |  |
| 17 | `src/app/Events/first-timers-dashboard/first-timers-dashboard.component.ts` | 995 | 996 | 1 | S19 newer→ignore |  |
| 18 | `src/app/Events/live-event-dashboard-v2/live-event-dashboard-v2.component.html` | 1393 | 1398 | 5 | S19 newer→ignore |  |
| 19 | `src/app/Events/live-event-dashboard-v2/live-event-dashboard-v2.component.ts` | 4615 | 4616 | 1 | S19 newer→ignore |  |
| 20 | `src/app/EvolutionMapping/evolution-mapping/evolution-mapping.component.html` | 186 | 203 | 17 | S19 newer→ignore |  |
| 21 | `src/app/EvolutionMapping/evolution-mapping/evolution-mapping.component.ts` | 526 | 527 | 1 | S19 newer→ignore |  |
| 22 | `src/app/EvolutionMapping/evolution-mapping/participant-evolution-mapping/participant-evolution-mapping.component.css` | 201 | 297 | 96 | S19 newer→ignore |  |
| 23 | `src/app/EvolutionMapping/evolution-mapping/participant-evolution-mapping/participant-evolution-mapping.component.html` | 90 | 117 | 27 | S19 newer→ignore |  |
| 24 | `src/app/EvolutionMapping/evolution-mapping/participant-evolution-mapping/participant-evolution-mapping.component.ts` | 302 | 372 | 70 | S19 newer→ignore |  |
| 25 | `src/app/EvolutionMapping/video-player.component.ts` | 457 | 473 | 16 | S19 newer→ignore |  |
| 26 | `src/app/Journey Onboarding/delivery-dashboard-clone/delivery-dashboard-clone.component.html` | 1790 | 1817 | 27 | S19 newer→ignore |  |
| 27 | `src/app/Journey Onboarding/delivery-dashboard-clone/delivery-dashboard-clone.component.ts` | 6257 | 6376 | 119 | S19 newer→ignore |  |
| 28 | `src/app/Journey Onboarding/journeycoach-dashboard/journeycoach-dashboard.component.html` | 1550 | 1571 | 21 | S19 newer→ignore |  |
| 29 | `src/app/Journey Onboarding/journeycoach-dashboard/journeycoach-dashboard.component.ts` | 5590 | 5591 | 1 | S19 newer→ignore |  |
| 30 | `src/app/Journey Onboarding/saleslead/saleslead.component.html` | 333 | 343 | 10 | S19 newer→ignore |  |
| 31 | `src/app/Journey Onboarding/saleslead/saleslead.component.ts` | 1902 | 1904 | 2 | S19 newer→ignore |  |
| 32 | `src/app/New-Workshop/workshop-dashboard/enroll/enroll.component.html` | 38 | 45 | 7 | S19 newer→ignore |  |
| 33 | `src/app/New-Workshop/workshop-dashboard/enroll/enroll.component.ts` | 116 | 130 | 14 | S19 newer→ignore |  |
| 34 | `src/app/New-Workshop/workshop-dashboard/workshop-dashboard.component.ts` | 2561 | 2723 | 162 | S19 newer→ignore |  |
| 35 | `src/app/OpenVidu/join-openvidu-call/join-openvidu-call.component.html` | 488 | 488 | 0 | S19 newer→ignore |  |
| 36 | `src/app/OpenVidu/list-openvidu-room/list-openvidu-room.component.ts` | 280 | 291 | 11 | S19 newer→ignore |  |
| 37 | `src/app/Participants Profile Management/participants-analytics/bulk-add-products/bulk-add-products.component.ts` | 737 | 752 | 15 | S19 newer→ignore |  |
| 38 | `src/app/Participants Profile Management/participants-analytics/create-segments-dialog/create-segments-dialog.component.css` | 813 | 1196 | 383 | S19 newer→ignore |  |
| 39 | `src/app/Participants Profile Management/participants-analytics/create-segments-dialog/create-segments-dialog.component.html` | 473 | 624 | 151 | S19 newer→ignore |  |
| 40 | `src/app/Participants Profile Management/participants-analytics/create-segments-dialog/create-segments-dialog.component.ts` | 642 | 1087 | 445 | S19 newer→ignore |  |
| 41 | `src/app/Participants Profile Management/participants-analytics/manage-participantlist-dialog/manage-participantlist-dialog.component.css` | 1129 | 2526 | 1397 | S19 newer→ignore |  |
| 42 | `src/app/Participants Profile Management/participants-analytics/manage-participantlist-dialog/manage-participantlist-dialog.component.html` | 469 | 1053 | 584 | S19 newer→ignore |  |
| 43 | `src/app/Participants Profile Management/participants-analytics/manage-participantlist-dialog/manage-participantlist-dialog.component.ts` | 625 | 1694 | 1069 | S19 newer→ignore |  |
| 44 | `src/app/Participants Profile Management/participants-analytics/participants-analytics.component.html` | 878 | 891 | 13 | S19 newer→ignore |  |
| 45 | `src/app/Participants Profile Management/participants-analytics/participants-analytics.component.ts` | 3983 | 3985 | 2 | S19 newer→ignore |  |
| 46 | `src/app/Participants Profile Management/profilelist/profilelist.component.html` | 129 | 148 | 19 | S19 newer→ignore |  |
| 47 | `src/app/Participants Profile Management/profilelist/profilelist.component.ts` | 352 | 354 | 2 | S19 newer→ignore |  |
| 48 | `src/app/Product Designer/delivery-sequence/delivery-sequence.component.ts` | 328 | 318 | -10 | golden bigger→review |  |
| 49 | `src/app/Product Designer/product-delivery/product-delivery.component.ts` | 233 | 227 | -6 | golden bigger→review |  |
| 50 | `src/app/app.component.html` | 159 | 159 | 0 | S19 newer→ignore |  |
| 51 | `src/app/app.config.ts` | 38 | 33 | -5 | golden bigger→review |  |
| 52 | `src/app/app.routes.ts` | 699 | 697 | -2 | golden bigger→review |  |
| 53 | `src/app/big/atcmodel-level-config/atcmodel-level-config.component.html` | 77 | 77 | 0 | S19 newer→ignore |  |
| 54 | `src/app/big/big-activity-log/big-activity-log.component.html` | 174 | 174 | 0 | S19 newer→ignore |  |
| 55 | `src/app/big/big-aggregate-event-level/big-aggregate-event-level.component.html` | 179 | 179 | 0 | S19 newer→ignore |  |
| 56 | `src/app/big/big-aggregate/big-aggregate.component.html` | 170 | 170 | 0 | S19 newer→ignore |  |
| 57 | `src/app/big/big-cohort-clone-2/big-cohort-clone-2.component.html` | 955 | 954 | -1 | golden bigger→review |  |
| 58 | `src/app/big/big-dashboard/big-dashboard.component.html` | 1029 | 1029 | 0 | S19 newer→ignore |  |
| 59 | `src/app/big/big-level/big-level.component.html` | 45 | 45 | 0 | S19 newer→ignore |  |
| 60 | `src/app/big/form-based-submission/form-based-submission.component.html` | 372 | 372 | 0 | S19 newer→ignore |  |
| 61 | `src/app/big/manual-assignments/manual-assignments.component.html` | 238 | 237 | -1 | golden bigger→review |  |
| 62 | `src/app/big/monitor-activity-log/monitor-activity-log.component.html` | 190 | 190 | 0 | S19 newer→ignore |  |
| 63 | `src/app/big/participant-assignment-board/participant-assignment-board.component.html` | 246 | 245 | -1 | golden bigger→review |  |
| 64 | `src/app/big/validate-participants-assignment/validate-participants-assignment.component.html` | 416 | 411 | -5 | golden bigger→review |  |
| 65 | `src/app/big/watch-videos/watch-videos.component.html` | 125 | 125 | 0 | S19 newer→ignore |  |
| 66 | `src/app/big/zoom-meeting/zoom-meeting.component.html` | 60 | 60 | 0 | S19 newer→ignore |  |
| 67 | `src/app/queue system/QueueWebVerison1/queue-web-version1.component.css` | 544 | 543 | -1 | golden bigger→review |  |
| 68 | `src/app/queue system/accept-other-studio/accept-other-studio.component.html` | 8 | 8 | 0 | S19 newer→ignore |  |
| 69 | `src/app/queue system/arenastudioactivity/arenastudioactivity.component.html` | 139 | 138 | -1 | golden bigger→review |  |
| 70 | `src/app/queue system/arenastudioactivity/arenastudioactivity.component.ts` | 154 | 148 | -6 | golden bigger→review |  |
| 71 | `src/app/queue system/assign-procedure-studio/assign-procedure-studio.component.html` | 59 | 59 | 0 | S19 newer→ignore |  |
| 72 | `src/app/queue system/assign-queue-studio/assign-queue-studio.component.html` | 51 | 51 | 0 | S19 newer→ignore |  |
| 73 | `src/app/queue system/assign-queue-studio/assign-queue-studio.component.ts` | 166 | 166 | 0 | S19 newer→ignore |  |
| 74 | `src/app/queue system/big-planner/big-planner.component.html` | 608 | 607 | -1 | golden bigger→review |  |
| 75 | `src/app/queue system/create-bulk-invitation/create-bulk-invitation.component.html` | 36 | 36 | 0 | S19 newer→ignore |  |
| 76 | `src/app/queue system/dynamic-queue-manager-clone/dynamic-queue-manager-clone.component.html` | 2734 | 2764 | 30 | S19 newer→ignore |  |
| 77 | `src/app/queue system/dynamic-queue-manager-clone/dynamic-queue-manager-clone.component.ts` | 6139 | 6225 | 86 | S19 newer→ignore |  |
| 78 | `src/app/queue system/dynamic-queue-manager/dynamic-queue-manager.component.html` | 610 | 610 | 0 | S19 newer→ignore |  |
| 79 | `src/app/queue system/dynamic-studio/dynamic-studio.component.html` | 533 | 532 | -1 | golden bigger→review |  |
| 80 | `src/app/queue system/event-opportunity-dashboard/event-opportunity-dashboard.component.css` | 1700 | 1903 | 203 | S19 newer→ignore |  |
| 81 | `src/app/queue system/event-opportunity-dashboard/event-opportunity-dashboard.component.html` | 724 | 947 | 223 | S19 newer→ignore |  |
| 82 | `src/app/queue system/event-opportunity-dashboard/event-opportunity-dashboard.component.ts` | 1265 | 1579 | 314 | S19 newer→ignore |  |
| 83 | `src/app/queue system/initiate-event-product/initiate-event-product.component.html` | 549 | 568 | 19 | S19 newer→ignore |  |
| 84 | `src/app/queue system/initiate-event-product/initiate-event-product.component.ts` | 1243 | 1245 | 2 | S19 newer→ignore |  |
| 85 | `src/app/queue system/invite-other-studio/invite-other-studio.component.html` | 38 | 38 | 0 | S19 newer→ignore |  |
| 86 | `src/app/queue system/people-involved/people-involved.component.html` | 31 | 31 | 0 | S19 newer→ignore |  |
| 87 | `src/app/queue system/preassign-studio/preassign-studio.component.html` | 16 | 16 | 0 | S19 newer→ignore |  |
| 88 | `src/app/queue system/queue-creation-v3/queue-creation-v3.component.css` | 822 | 806 | -16 | golden bigger→review |  |
| 89 | `src/app/queue system/queue-creation-v3/queue-creation-v3.component.html` | 904 | 924 | 20 | S19 newer→ignore |  |
| 90 | `src/app/queue system/queue-creation-v3/queue-creation-v3.component.ts` | 1317 | 1342 | 25 | S19 newer→ignore |  |
| 91 | `src/app/queue system/queue-invitation-approval/queue-invitation-approval.component.html` | 106 | 106 | 0 | S19 newer→ignore |  |
| 92 | `src/app/queue system/queue-planning-review/queue-planning-review.component.css` | 4372 | 4545 | 173 | S19 newer→ignore |  |
| 93 | `src/app/queue system/queue-planning-review/queue-planning-review.component.html` | 1348 | 1456 | 108 | S19 newer→ignore |  |
| 94 | `src/app/queue system/queue-planning-review/queue-planning-review.component.ts` | 5280 | 5472 | 192 | S19 newer→ignore |  |
| 95 | `src/app/queue system/zoom-clientview/zoom-clientview.component.css` | 55 | 384 | 329 | S19 newer→ignore |  |
| 96 | `src/app/queue system/zoom-clientview/zoom-clientview.component.html` | 35 | 153 | 118 | S19 newer→ignore |  |
| 97 | `src/app/queue system/zoom-clientview/zoom-clientview.component.ts` | 260 | 935 | 675 | S19 newer→ignore |  |
| 98 | `src/app/web-studio-invitation/web-studio-invitation.component.html` | 91 | 91 | 0 | S19 newer→ignore |  |
| 99 | `src/environments/environment.development.ts` | 16 | 47 | 31 | S19 newer→ignore |  |
| 100 | `src/environments/environment.ts` | 17 | 47 | 30 | S19 newer→ignore |  |
| 101 | `src/index.html` | 142 | 140 | -2 | golden bigger→review |  |
| 102 | `src/main.ts` | 54 | 40 | -14 | golden bigger→review |  |
| 103 | `src/styles.css` | 166 | 286 | 120 | S19 newer→ignore |  |

## ONLY IN GOLDEN (absent from S19 — unreferenced = removed in new line)
| # | File | golden LOC | referenced in S19? | CHOICE |
|---|------|-----------:|--------------------|--------|
| 1 | `src/app/OneWayAppCommunication/onewaychannel/oneway-channel/oneway-channel.component.css` | 577 | (none found earlier) |  |
| 2 | `src/app/OneWayAppCommunication/onewaychannel/oneway-channel/oneway-channel.component.html` | 464 | (none found earlier) |  |
| 3 | `src/app/OneWayAppCommunication/onewaychannel/oneway-channel/oneway-channel.component.spec.ts` | 23 | (none found earlier) |  |
| 4 | `src/app/OneWayAppCommunication/onewaychannel/oneway-channel/oneway-channel.component.ts` | 481 | (none found earlier) |  |
| 5 | `src/app/OneWayAppCommunication/onewaytemplates/oneway-templates.component.css` | 1172 | (none found earlier) |  |
| 6 | `src/app/OneWayAppCommunication/onewaytemplates/oneway-templates.component.html` | 802 | (none found earlier) |  |
| 7 | `src/app/OneWayAppCommunication/onewaytemplates/oneway-templates.component.spec.ts` | 23 | (none found earlier) |  |
| 8 | `src/app/OneWayAppCommunication/onewaytemplates/oneway-templates.component.ts` | 925 | (none found earlier) |  |
| 9 | `src/app/queue system/dynamic-studio/dynamic-studio.atc-list.render.smoke.spec.ts` | 173 | (none found earlier) |  |
| 10 | `src/app/queue system/event-opportunity-dashboard/event-opportunity-dashboard-v2/event-opportunity-dashboard-v2.component.css` | 1903 | (none found earlier) |  |
| 11 | `src/app/queue system/event-opportunity-dashboard/event-opportunity-dashboard-v2/event-opportunity-dashboard-v2.component.html` | 947 | (none found earlier) |  |
| 12 | `src/app/queue system/event-opportunity-dashboard/event-opportunity-dashboard-v2/event-opportunity-dashboard-v2.component.spec.ts` | 23 | (none found earlier) |  |
| 13 | `src/app/queue system/event-opportunity-dashboard/event-opportunity-dashboard-v2/event-opportunity-dashboard-v2.component.ts` | 1571 | (none found earlier) |  |
| 14 | `src/app/queue system/queue-flow-visualizer/README.md` | 66 | (none found earlier) |  |
| 15 | `src/app/queue system/queue-flow-visualizer/queue-flow-demo.component.ts` | 148 | (none found earlier) |  |
| 16 | `src/app/queue system/queue-flow-visualizer/queue-flow-visualizer.component.css` | 821 | (none found earlier) |  |
| 17 | `src/app/queue system/queue-flow-visualizer/queue-flow-visualizer.component.ts` | 783 | (none found earlier) |  |
| 18 | `src/app/queue system/queue-flow-visualizer/queue-flow.model.ts` | 342 | (none found earlier) |  |
| 19 | `src/app/queue system/queue-flow-visualizer/queue-form-mapping.ts` | 77 | (none found earlier) |  |
| 20 | `src/app/queue system/queue-flow-visualizer/verify-oracle.mjs` | 165 | (none found earlier) |  |
| 21 | `src/app/role.guard.ts` | 67 | (none found earlier) |  |
| 22 | `src/assets/queue-configs/BhQgc9dU9Q27skitBCUD.json` | 364 | (none found earlier) |  |
| 23 | `src/assets/queue-configs/DRIFT-demo.json` | 1239 | (none found earlier) |  |
| 24 | `src/assets/queue-configs/L3rqCrqDBsshd7HM5YRn.json` | 1227 | (none found earlier) |  |
| 25 | `src/assets/queue-configs/XI0RAaTCqPb1KiOJbYHU.json` | 586 | (none found earlier) |  |
| 26 | `src/assets/queue-configs/index.json` | 55 | (none found earlier) |  |
| 27 | `src/assets/queue-configs/lWbXqjTbFNBeK9ENRNYe.json` | 738 | (none found earlier) |  |
| 28 | `src/assets/queue-configs/vuvS7eBgTxLKufnesLQT.json` | 375 | (none found earlier) |  |
| 29 | `src/environments/environment.emulator.ts` | 21 | (none found earlier) |  |
