/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { strict as assert } from 'assert';
import { ActivityBar } from 'vscode-extension-tester';

// Sample Activity Bar test adopted from vscode-extension-tester-example
// Helps validate that the UI test harness is wired correctly before running
// Flowchart Machine specific scenarios.
describe('Activity Bar smoke test', () => {
  let activityBar: ActivityBar;

  before(async function () {
    this.timeout(15_000);
    activityBar = new ActivityBar();
  });

  it('shows the Explorer view control', async () => {
    const controls = await activityBar.getViewControls();
    assert.ok(controls.length > 0, 'Activity Bar should expose at least one view control');

    const titles = await Promise.all(
      controls.map(async (control) => control.getTitle()),
    );

    assert.ok(titles.some((title) => title.startsWith('Explorer')), 'Explorer control should be present');
  });

  it('opens the Explorer view when requested', async () => {
    const explorerControl = await activityBar.getViewControl('Explorer');
    const view = await explorerControl?.openView();

    assert.notStrictEqual(view, undefined, 'Explorer view should be available');
    assert.strictEqual(await view?.isDisplayed(), true, 'Explorer view should be displayed');
  });
});
