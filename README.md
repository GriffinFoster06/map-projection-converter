# Map projection converter

Most software doesn't support converting map projections back to equirectangular, so this is a half-assed solution to that. It now also supports converting equirectangular maps into other projections. Use the conversion direction selector in the UI to switch between projection → equirectangular and equirectangular → projection.

Currently supported projections:

- Mercator
- Nicolosi Globular
- Robinson
- Winkel Tripel

No guarantees that any of these will be perfectly accurate.
Inverse projections (equirectangular → projection) use numeric solvers for some projections, so small artifacts and edge clipping are expected.

This repo primarily exists so that if my hosting of the website goes down people can still use the scripts.

## View map as globe

Since I keep forgetting what the url for this app is and struggle to find it on google every time, I am putting this link here for my own benefit.

https://woowspace.com/MapToGlobe.html

## License

MIT
