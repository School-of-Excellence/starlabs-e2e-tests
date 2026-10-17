# Flutter manifest — active / retired review

> Generated from **reachability**: a file is ACTIVE if `lib/main.dart` or a test can reach it
> through `import`/`export`/`part` (relative paths normalised, `%20` decoded). Everything below is
> **proposed RETIRED**. Retired means only one thing: *a change there never blocks a push.*


**259 files · 180 active · 79 proposed retired · 85 of the active are covered by a test**


## How to review

Tick a box to say **"no — this is actually LIVE, keep it active"**. Leave unticked to accept retirement.
Section C is the only one that really needs judgement; A and B are high confidence.

To check any single file yourself:

```bash
grep -rn "FileName" /Users/m1/Documents/breakthroughs-flutter/lib --include="*.dart"
```


## A. Replaced by a live twin — 9 files

A live file declares the same class, so this is the superseded copy. Highest confidence.

- [ ] `JourneyOnboardingProcess/journeyBoardingHome.dart` — `JourneyOnboardingHome` is owned by a live file
- [ ] `Main Screen/exploreSocialOld.dart` — `ExploreSocial, _ExploreSocial` is owned by a live file
- [ ] `Main Screen/myprofiledashboardold.dart` — `MyProfileDashboard, _MyProfileDashboard` is owned by a live file
- [ ] `arena Start CW/startcwOption.dart` — `_AnimatedTextDialog, _AnimatedTextDialogState` is owned by a live file
- [ ] `forgotpasswordOld.dart` — `ForgotPassword, _ForgotPassword` is owned by a live file
- [ ] `loginOld.dart` — `Login, _Login` is owned by a live file
- [ ] `mastercalendar_old.dart` — `CalendarMonthCard, Mastercalendar` is owned by a live file
- [ ] `procedurecompleted.dart` — `CompleteProcedure, _CompleteProcedure` is owned by a live file
- [ ] `registerOld.dart` — `Register, _Register` is owned by a live file

## B. No reference anywhere — 47 files

Nothing imports them and none of their class names appear in live code.

- [ ] `ActionsToTake.dart`
- [ ] `BIG Dashboard/Big accelerator.dart`
- [ ] `BIG Dashboard/Big dashboard.dart`
- [ ] `BIG Dashboard/EIS Dashboard.dart`
- [ ] `BIG Dashboard/atc accelerator.dart`
- [ ] `BIG Dashboard/bigGameficationLive.dart`
- [ ] `Chatx/chatxMain.dart`
- [ ] `Chatx/chatxadmin.dart`
- [ ] `Chatx/generaluser.dart`
- [ ] `Community Snippets/playSnippet.dart`
- [ ] `Delivery Queue/queueStudioChat.dart`
- [ ] `EIFlix/myList.dart`
- [ ] `EIFlix/series.dart`
- [ ] `Journey Dashboard/Journey Dashboard.dart`
- [ ] `Main Screen/myjourney.dart`
- [ ] `Mentoring/diagnosticMentoring.dart`
- [ ] `Mentoring/initiateATC.dart`
- [ ] `Mentoring/validateATC.dart`
- [ ] `MoreMenu.dart`
- [ ] `PostEvent - Achievements/createpost.dart`
- [ ] `PostEvent - Achievements/createpostTags.dart`
- [ ] `PostEvent - Achievements/mycelebration.dart`
- [ ] `PostEvent - Achievements/previewpost.dart`
- [ ] `PostEvent - Achievements/social.dart`
- [ ] `PreEvent - Tweets/noProductTweets.dart`
- [ ] `Services/callkitBackground.dart`
- [ ] `Solar Voice/solarvoiceHomeOld.dart`
- [ ] `Solar Voice/vitality.dart`
- [ ] `Surprise Content/contentExplore.dart`
- [ ] `Surprise Content/contentPlayer.dart`
- [ ] `Surprise Content/starredContent.dart`
- [ ] `Widgets/fillParticipantAEl.dart`
- [ ] `Widgets/notificationMessage.dart`
- [ ] `Widgets/notificationlogold.dart`
- [ ] `Widgets/postGridWidget.dart`
- [ ] `Widgets/unknownPage.dart`
- [ ] `Widgets/webViewScreen.dart`
- [ ] `addatclist.dart`
- [ ] `arena Start CW/chooseProcedure.dart`
- [ ] `atcUploadPending.dart`
- [ ] `atctimeline.dart`
- [ ] `customerRegistrationForm.dart`
- [ ] `eisscreen.dart`
- [ ] `post.dart`
- [ ] `productLevel/stepper.dart`
- [ ] `profile.dart`
- [ ] `uploadATC.dart`

## C. Needs your eye — 23 files

Unreachable by import, but a class name they declare does appear somewhere in live code.

- [ ] `Arena Elements/postStories.dart` — mentions: `PostStories`
- [ ] `Chatx/databasehelper.dart` — mentions: `DatabaseHelper`
- [ ] `Community Snippets/openImage.dart` — mentions: `OpenImage`
- [ ] `Community Snippets/openVideo.dart` — mentions: `OpenVideo`
- [ ] `Delivery Event/viewupcomingopportunities.dart` — mentions: `Viewupcomingopportunities`
- [ ] `EIFlix Workshop New/testvideo.dart` — mentions: `_WorkshopVideoPlayer`
- [ ] `JourneyOnboardingProcess/journeyOrientation.dart` — mentions: `JourneyOrientation`
- [ ] `JourneyOnboardingProcess/journeyProductPlanning.dart` — mentions: `JourneyProductPlanning`
- [ ] `JourneyOnboardingProcess/orientationOnboarding.dart` — mentions: `OrientationOnboarding`
- [ ] `Main Screen/addSignificanceConsequence.dart` — mentions: `AddSignificanceConsequence`
- [ ] `Main Screen/expandPost.dart` — mentions: `ExpandPost`
- [ ] `Main Screen/expandvideo.dart` — mentions: `ExpandedVideo`
- [ ] `Main Screen/shareMajorBreakthrough.dart` — mentions: `ShareMajorBreakthrough`
- [ ] `Mode Widget/reviewATC.dart.dart` — mentions: `ReviewATC`
- [ ] `PostEvent - Achievements/achievements.dart` — mentions: `Achievements`
- [ ] `Services/qualityLinks.dart` — mentions: `QualityLinks`
- [ ] `Surprise Content/SurpriseContent.dart` — mentions: `SurpriseContent`
- [ ] `commentlikes.dart` — mentions: `CommentLikes`
- [ ] `listGridPersonal.dart` — mentions: `ListGridPersonal`
- [ ] `listGridSocial.dart` — mentions: `ListGridSocial`
- [ ] `planTogether.dart` — mentions: `Plantogether`
- [ ] `reports/evolutionMappingSummary.dart` — mentions: `EvolutionMappingSummary`
- [ ] `snippetStory.dart` — mentions: `SnippetStory`

## Known blind spot

A file invoked from native via `@pragma('vm:entry-point')` has no import and looks dead.
Three files use `@pragma`; only `Services/callkitBackground.dart` is in this list, and it is entirely
commented out — so no false positive was found. Worth keeping in mind while reviewing.

