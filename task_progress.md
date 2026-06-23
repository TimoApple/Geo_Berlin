# Task Progress – ArUco Bugfixes

- [ ] 1. `ARUCO_5X5_1000` Dictionary in `src/libs/aruco.js` einfügen (Array-of-Arrays aus node_modules)
- [ ] 2. `src/utils/arucoDetector.ts` auf `'ARUCO_5X5_1000'` umstellen
- [ ] 3. `src/hooks/useArucoScanner.ts`: Temporären Log für raw detector id einbauen
- [ ] 4. `src/hooks/useArucoScanner.ts`: `m.id + 1` beibehalten (wird nach Test bestätigt/korrigiert)
- [ ] 5. Build testen: `npx tsc --noEmit`
