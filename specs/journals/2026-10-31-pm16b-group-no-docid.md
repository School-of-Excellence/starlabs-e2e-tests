# 2026-10-31 — PM-16B: disabling a recommended-playlist group that stores no docid

App: starlabs-angular `specs/journals/2026-10-30-recommended-playlist-docid.md`. The group row now takes its id
from the snapshot; the toggle used to crash with `doc(firestore, 'buffermix archive', undefined)`.

**Why the seed looks like this:** BUF_NODOCID deliberately omits the `docid` field, the shape that crashed. Its
own linked playlist doc (RMP_NODOCID) proves the cascade found the right `bufferdocref`. BUF1 and RMP1 are the
negative control: the toggle must not change them. The old seed note saying `docid` MUST be set is gone, since
the app no longer reads it from the data.
