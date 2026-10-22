# Credits and third-party notices

Chess.MAS is written by MD Al Shahriar (MAS Studio) and released under the MIT License (see `LICENSE`).
It bundles the following third-party work, each under its own license.

## chess.js 0.12.0 — `js/chess.min.js`

Game rules (legal moves, SAN, draw detection). <https://github.com/jhlywa/chess.js>

```
Copyright (c) 2021, Jeff Hlywa (jhlywa@gmail.com)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

## Piece artwork — `js/pieces.js`

| Set in Chess.MAS | Original | Author | License |
| --- | --- | --- | --- |
| Classic | Standard SVG chess pieces (Wikimedia Commons) | Colin M.L. Burnett (Cburnett) | BSD 3-Clause (author's multi-license option) |
| Neo | "celtic" (lichess.org) | Maurizio Monge | MIT |
| Minimal | "kiwen-suwi" (lichess.org) | neverRare — <https://lichess.org/@/neverRare> | CC BY 4.0 — <https://creativecommons.org/licenses/by/4.0/> |
| Pixel | Original 16×16 pixel art | MAS Studio | MIT |

Classic pieces notice:

```
Copyright © Colin M.L. Burnett

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

Neo pieces: Copyright (c) Maurizio Monge, released under the MIT License (same terms as `LICENSE`).

The SVG files were whitespace-minified and given a `viewBox` so they scale; the drawings are unchanged.

## Fonts

Rajdhani, Manrope, JetBrains Mono, Press Start 2P and VT323 are loaded from Google Fonts under the SIL Open Font License 1.1. They are not stored in this repository.

## Engine and opening book

The MAS Engine (`js/engine.js`) and the opening book (`js/book.js`) are original work for Chess.MAS. The evaluation uses the published PeSTO piece-square tables by Ronald Friederich.
