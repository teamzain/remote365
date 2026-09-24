import assert from 'node:assert/strict';
import test from 'node:test';
import { isViewerMediaActive, hasActiveMediaViewer, updateHostMediaActivity } from './viewerMediaPolicy.ts';

test('three open devices: only selected visible tab streams across switches', () => {
  const tabs = ['a', 'b', 'c'];
  const hosts = tabs.map(() => ({}));
  for (const selected of ['a', 'c', 'b', 'a']) {
    tabs.forEach((tab, i) => updateHostMediaActivity([hosts[i]], hosts[i], isViewerMediaActive(tab, selected, true, false)));
    assert.deepEqual(hosts.map(p => !p.mediaPaused), tabs.map(t => t === selected));
  }
});

test('minimizing or hiding parks every tab; restoring wakes only the selection', () => {
  for (const [visible, minimized] of [[true, true], [false, false]]) {
    for (const id of ['a', 'b', 'c']) assert.equal(isViewerMediaActive(id, 'b', visible, minimized), false);
  }
  assert.equal(isViewerMediaActive('b', 'b', true, false), true);
  assert.equal(isViewerMediaActive('a', 'b', true, false), false);
});

test('parking one viewer does not stop capture for another viewer on the same host', () => {
  const peers = [{}, {}];
  assert.equal(updateHostMediaActivity(peers, peers[0], false), 'none');
  assert.equal(hasActiveMediaViewer(peers), true);
  assert.equal(updateHostMediaActivity(peers, peers[1], false), 'pause');
  assert.equal(hasActiveMediaViewer(peers), false);
  assert.equal(updateHostMediaActivity(peers, peers[0], true), 'resume');
  assert.equal(updateHostMediaActivity(peers, peers[1], true), 'keyframe');
});

test('duplicate activity signals do not restart encoders', () => {
  const peer = {};
  assert.equal(updateHostMediaActivity([peer], peer, true), 'none');
  assert.equal(updateHostMediaActivity([peer], peer, false), 'pause');
  assert.equal(updateHostMediaActivity([peer], peer, false), 'none');
  assert.equal(updateHostMediaActivity([peer], peer, true), 'resume');
  assert.equal(updateHostMediaActivity([peer], peer, true), 'none');
});

test('legacy viewers stay active; removing the last active viewer leaves a parked host', () => {
  const background = { mediaPaused: true };
  assert.equal(hasActiveMediaViewer([background, {}]), true);
  assert.equal(hasActiveMediaViewer([background]), false);
  assert.equal(hasActiveMediaViewer([]), false);
});

test('peer iterators are safe across the before/after activity checks', () => {
  const a = {}, b = {};
  const peers = new Map([['a', a], ['b', b]]);
  assert.equal(updateHostMediaActivity(peers.values(), a, false), 'none');
  assert.equal(updateHostMediaActivity(peers.values(), b, false), 'pause');
  assert.equal(updateHostMediaActivity(peers.values(), a, true), 'resume');
});
