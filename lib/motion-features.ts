/**
 * Lazy-motion feature loader: strips ~half of framer-motion's render machinery
 * from the initial bundle. domMax covers AnimatePresence, variants, layout
 * animations and drag — everything used in this app.
 */
export const loadFeatures = () => import("framer-motion").then((m) => m.domMax);
