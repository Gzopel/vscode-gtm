'use strict';

import * as vscode from 'vscode';
const spawn = require('child_process').spawn;

interface Result {
  code: number;
  output: string;
}

function run_cmd(cmd: string, args: string[]): Promise<Result> {
  const child = spawn(cmd, args);
  let output = "";
  return new Promise((resolve, reject) => {
    child.on('error', (code: number) => {
      console.error('error', output);
      reject(<Result>{ code, output });
    });
    child.stdout.on('data', (buffer) => output += buffer.toString());
    child.stderr.on('data', (buffer) => output += buffer.toString()); // since gtm -v outputs to stderr on ubuntu....
    child.on('close', (code: number) => resolve(<Result>{ code, output }));
  });
}

export function activate(context: vscode.ExtensionContext) {
  // check if gtm is installed + avaliable
  run_cmd('gtm', ['-v'])
    .then((res: Result) => {
      if(res.output < 'v1.0-beta.8'){
         vscode.window.showWarningMessage('Installed gtm version is below v1.0-beta.8. Please update your gtm installation.');
       }
    }, (res: Result) => {
      if (res.code < 0) {
        vscode.window.showErrorMessage('gtm is not avaliable on your $PATH. please install it first');
      }
    });
  let subscriptions: vscode.Disposable[] = [];
  let lastUpdated: Date = new Date();
  let lastSavedFileName: string;
  const MIN_UPDATE_FREQUENCE_MS = 30000; // 30 seconds

  function handleUpdateEvent(fileName: string){
    const now = new Date();
    // if a new file is being saved OR it have been at least MIN_UPDATE_FREQUENCE_MS, record it
    if (fileName !== lastSavedFileName || (now.getTime() - lastUpdated.getTime()) >= MIN_UPDATE_FREQUENCE_MS) {
      run_cmd('gtm', ['record', '--status', lastSavedFileName])
        .then((res: Result) => vscode.window.setStatusBarMessage(res.output));
      lastSavedFileName = fileName;
      lastUpdated = now;
    }
  }

  // report to gtm everytime a file is saved
  vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => handleUpdateEvent(e.fileName), this, subscriptions);

  // report to gtm everytime the user's selection of text changes
  vscode.window.onDidChangeTextEditorSelection((e:vscode.TextEditorSelectionChangeEvent) => handleUpdateEvent(e.textEditor.document.fileName), this, subscriptions);

  // report  to gtm everytime the user switches textEditors
  vscode.window.onDidChangeActiveTextEditor((e:vscode.TextEditor) => handleUpdateEvent(e.document.fileName), this, subscriptions);
}

// always active, so no need to deactivate
