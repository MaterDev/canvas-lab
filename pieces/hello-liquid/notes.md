# Hello / Liquid Space

The Canvas Lab welcome piece. A WebGL2 fragment shader:

- **Space**: domain-warped fbm nebula + hashed twinkling starfield, sampled as a function so it can be refracted.
- **Prismatic lasers**: rotating beams with per-channel (RGB) chromatic offset — the "rainbow refraction" look.
- **Liquid text**: "hello world" is drawn to a texture; its mask drives a water surface (rippled normals) that refracts the space behind it with chromatic dispersion, a fresnel rim, and a specular glint.

Rendered at a capped internal resolution and upscaled, so it stays smooth in the mirrored viewer; open in real Chrome for full crispness. WebGL2 (not WebGPU) so it renders in the viewer too.
