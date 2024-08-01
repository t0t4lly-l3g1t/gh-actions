const core = require('@actions/core');
const exec = require('@actions/exec');

// Matches alphanumeric string with _-./; no spaces or other chars allowed
const validateBranchName = ({ branchName }) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({ dirName }) => /^[a-zA-Z0-9_\-\/]+$/.test(dirName);

async function run() {
    const baseBranch = core.getInput('base-branch');
    const targetBranch = core.getInput('target-branch');
    const ghToken = core.getInput('gh-token'); // this needs to be a secret
    const workingDir = core.getInput('working-directory');
    const debug = core.getBooleanInput('debug');
    
    core.setSecret('ghToken'); // protect the GitHub token by making it a secret. 
    
    if (!validateBranchName({ branchName: baseBranch })) {
        core.setFailed('Invalid base branch name. Branch names should only include chars, numbers, hyphens, underscores, dots, and forward slashes');
        return;
    }
    
    if (!validateBranchName({ branchName: targetBranch })) {
        core.setFailed('Invalid target branch name. Branch names should only include chars, numbers, hyphens, underscores, dots, and forward slashes');
        return;
    }
    
    if (!validateDirectoryName({ dirName: workingDir })) {
        core.setFailed('Invalid working directory name. Directory names should only include chars, numbers, hyphens, underscores, and forward slashes');
        return;
    }
    
    core.info(`[js-dependency-update] : base branch is ${baseBranch}`);
    core.info(`[js-dependency-update] : target branch is ${targetBranch}`);
    core.info(`[js-dependency-update] : working directory is ${workingDir}`);
    
    await exec.exec('npm update', [], {
        cwd: workingDir
    });
    
    const gitStatus = await exec.getExecOutput('git status -s package*.json', [], {
        cwd: workingDir
    });
    
    if (gitStatus.stdout.length > 0) {
        core.info('[js-dependency-update] : There are updates available.');
    } else {
        core.info('[js-dependency-update] : No updates at this time.');
    }
    
    core.info('I am a custom JS action.');
}

run();

  /*
    1. parse inputs: 
     1.1 base-branch from which to check for updates. 
     1.2 target-branch to use to create the PR.
     1.3 GitHub Token for authentication (to create PRs). 
     1.4 Working Dir for which to check for deps. 
    2. exec the npm update command withing the working dir.
    3. Check if there are modified package*.json files.
    4. If there are modified files:
     4.1 Add and commit files to the target branch. 
     4.2 Create a PR to the base-branch using the target-branch using the octokit API
    5. Otherwise, conclude the custom action. 
    */