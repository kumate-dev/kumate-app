/**
 * Entry point.
 *
 * Deliberately thin: everything that used to live here — the pre-boot theme resolution,
 * the router, the toaster — has moved to where it belongs. The theme script is in
 * `index.html` (it has to run before the bundle to avoid a flash), and the router and
 * toaster are in `app/App.tsx`.
 *
 * There is no `StrictMode` equivalent and nothing to add one for: Solid renders each
 * component function exactly once, so the double-invocation bugs StrictMode exists to
 * surface cannot occur.
 */

import { render } from 'solid-js/web';

import { App } from '@/app/App';

import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('#root is missing from index.html — the app cannot mount.');
}

render(() => <App />, root);
