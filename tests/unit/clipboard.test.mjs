import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractImageFilesFromClipboardEvent,
  readImageFromClipboard,
} from '@/lib/clipboard';

test('extractImageFilesFromClipboardEvent: extrae archivos de imagen desde items (DataTransferItemList)', () => {
  const dummyFile = new File(['fake-png-content'], 'test.png', { type: 'image/png' });
  const fakeEvent = {
    clipboardData: {
      items: [
        {
          type: 'text/plain',
          getAsFile: () => null,
        },
        {
          type: 'image/png',
          getAsFile: () => dummyFile,
        },
      ],
      files: [],
    },
  };

  const extracted = extractImageFilesFromClipboardEvent(fakeEvent);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].name, 'test.png');
  assert.equal(extracted[0].type, 'image/png');
});

test('extractImageFilesFromClipboardEvent: extrae archivos desde files si items no tiene archivos', () => {
  const dummyJpg = new File(['fake-jpg-content'], 'test.jpg', { type: 'image/jpeg' });
  const fakeEvent = {
    clipboardData: {
      items: [],
      files: [dummyJpg],
    },
  };

  const extracted = extractImageFilesFromClipboardEvent(fakeEvent);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].name, 'test.jpg');
});

test('extractImageFilesFromClipboardEvent: ignora datos sin imágenes o eventos sin clipboardData', () => {
  const emptyEvent = {};
  assert.deepEqual(extractImageFilesFromClipboardEvent(emptyEvent), []);

  const textEvent = {
    clipboardData: {
      items: [{ type: 'text/plain', getAsFile: () => null }],
      files: [],
    },
  };
  assert.deepEqual(extractImageFilesFromClipboardEvent(textEvent), []);
});

test('readImageFromClipboard: maneja entornos sin soporte o vacíos de forma segura sin excepciones', async () => {
  // En Node.js (servidor / entorno de pruebas sin window)
  const result = await readImageFromClipboard();
  assert.equal(result.file, null);
  assert.ok(result.error);
});
