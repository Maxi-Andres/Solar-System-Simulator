# Stellar stream credits

The tracks the halo's stellar streams are drawn along (`web/src/core/streams.ts`,
`web/src/scene/Streams.tsx`). Fetched only once the Stellar Streams layer is on and the
camera is out in the galaxy.

Every file added here must be recorded below with its source, credit and licence.
`web/src/core/streams.test.ts` enforces that: an uncredited file fails the build.

## `tracks.json`

**Source**: the galstreams library of stellar streams, version 1.2 (June 2026),
https://github.com/cmateu/galstreams -- C. Mateu, "galstreams: A library of Milky Way stellar
stream footprints and tracks", Mateu 2023, MNRAS 520, 5225. Each stream's track is its own
paper's, as galstreams implements it; each is credited by name in the file (`reference`) and in
the app's About.

**Licence**: BSD 3-Clause, Copyright (c) 2017, Cecilia Mateu. All rights reserved.
Redistribution and use in source and binary forms, with or without modification, are permitted
provided that redistributions retain the copyright notice, this list of conditions and the
following disclaimer; the disclaimer: THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND
CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. Neither the name of the copyright holder nor the
names of its contributors may be used to endorse or promote products derived from it without
specific prior written permission.

**What was done** (`tools/src/streams/prepareStreams.ts`, run as
`pnpm -C tools prepare:streams <galstreams package folder>`):

- Of each stream, the one track galstreams' master log marks "On", and only where it is an
  empirical track (fitted to the stream's members; not a great circle through its ends or about
  its pole): 118 streams.
- Its distance as galstreams has it: measured along the track (`distance: "track"`), or the
  paper's one distance for the whole stream where no distance track is measured (`"mean"`), or
  flagged by galstreams to be taken with caution (`"rough"`).
- Resampled to a point every 1.5 degrees along the sky, split where the track has a gap of more
  than 4 degrees; each point written as its place about the Sun, ICRS equatorial x, y, z in
  parsecs, rounded to the parsec.
- Its width on the sky (`widthDeg`): galstreams' `width_phi2`, the paper's or measured from the
  members; null where none is given.
- Names as the app shows them where galstreams' short form is not one ("Pal5" as "Palomar 5").
- Two references corrected: Ibata et al. 2024 (ApJ 967, 89) is not in galstreams'
  bibliography, and its entry for Ramos et al. 2020 is the corrigendum (A&A 640, C5) rather than
  the paper (A&A 638, A104).
