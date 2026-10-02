import * as monaco from 'monaco-editor/editor/editor.api';
import 'monaco-editor/languages/definitions/java/register';
import 'monaco-editor/languages/definitions/xml/register';
import 'monaco-editor/languages/definitions/ini/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import { loader } from '@monaco-editor/react';

// Bundle Monaco locally (no CDN) so it works under the strict CSP.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

monaco.editor.defineTheme('ats-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'f5c518' },
    { token: 'string', foreground: '7dd3c0' },
    { token: 'comment', foreground: '5b6684', fontStyle: 'italic' },
    { token: 'number', foreground: 'f7a35c' },
    { token: 'type', foreground: '7cc4ff' },
  ],
  colors: {
    'editor.background': '#070c1c',
    'editor.lineHighlightBackground': '#0f172b',
    'editorLineNumber.foreground': '#3a4566',
    'editorLineNumber.activeForeground': '#9aa3b8',
    'diffEditor.insertedTextBackground': '#2dd4bf22',
    'diffEditor.removedTextBackground': '#f8717122',
    'diffEditor.insertedLineBackground': '#2dd4bf14',
    'diffEditor.removedLineBackground': '#f8717114',
    'editorGutter.background': '#070c1c',
    'scrollbarSlider.background': '#2a365566',
  },
});

export const languageFor = (path: string) =>
  path.endsWith('.java') ? 'java' : path.endsWith('.xml') ? 'xml' : path.endsWith('.properties') ? 'ini' : 'plaintext';

export { monaco };
