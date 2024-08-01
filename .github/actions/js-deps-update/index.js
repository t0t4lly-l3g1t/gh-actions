const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const setupGit = async () => {
    await exec.exec('git config --global user.name "gh-automation"');
    await exec.exec('git config --global user.email "gh-automation@email.com"');
};

// Matches alphanumeric string with _-./; no spaces or other chars allowed
const validateBranchName = ({ branchName }) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({ dirName }) => /^[a-zA-Z0-9_\-\/]+$/.test(dirName);

async function run() {
    const baseBranch = core.getInput('base-branch', { required: true });
    const headBranch = core.getInput('head-branch', { required: true });
    const ghToken = core.getInput('gh-token', { required: true });
    const workingDir = core.getInput('working-directory', { required: true });
    const debug = core.getBooleanInput('debug');
    
    const commonExecOpts = {
        cwd: workingDir
    };
    
    core.setSecret(ghToken); // protect the GitHub token by making it a secret. 
    
    if (!validateBranchName({ branchName: baseBranch })) {
        core.setFailed('Invalid base branch name. Branch names should only include chars, numbers, hyphens, underscores, dots, and forward slashes');
        return;
    }
    
    if (!validateBranchName({ branchName: headBranch })) {
        core.setFailed('Invalid head branch name. Branch names should only include chars, numbers, hyphens, underscores, dots, and forward slashes');
        return;
    }
    
    if (!validateDirectoryName({ dirName: workingDir })) {
        core.setFailed('Invalid working directory name. Directory names should only include chars, numbers, hyphens, underscores, and forward slashes');
        return;
    }
    
    core.info(`[js-dependency-update] : base branch is ${baseBranch}`);
    core.info(`[js-dependency-update] : head branch is ${headBranch}`);
    core.info(`[js-dependency-update] : working directory is ${workingDir}`);
    
    await exec.exec('npm update', [], commonExecOpts);
    
    const gitStatus = await exec.getExecOutput('git status -s package*.json', [], commonExecOpts);
    
    if (gitStatus.stdout.length > 0) {
        core.info('[js-dependency-update] : There are updates available.');
        await setupGit();
        await exec.exec(`git checkout -b ${headBranch}`, [], commonExecOpts);
        await exec.exec('git add package.json package-lock.json', [], commonExecOpts);
        await exec.exec('git commit -m "chore: update dependencies"', [], commonExecOpts);
        
        try {
            await exec.exec(`git push -u origin ${headBranch}`, [], commonExecOpts);
        } catch (error) {
            core.warning('Failed to push branch. Attempting to rebase and push...');
            await exec.exec(`git pull --rebase origin ${baseBranch}`, [], commonExecOpts);
            await exec.exec(`git push -u origin ${headBranch}`, [], commonExecOpts);
        }

        const octokit = github.getOctokit(ghToken);
        try {
            await octokit.rest.pulls.create({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                title: 'Update NPM dependencies',
                body: 'This PR updates NPM packages',
                base: baseBranch,
                head: headBranch
            });
        } catch (e) {
            core.error('[js-dependency-update] : Something went wrong creating the PR. Check logs below.');
            core.setFailed(e.message);
            core.error(e);
        }
        
    } else {
        core.info('[js-dependency-update] : No updates at this time.');
    }    
}

run();
  /*
    1. parse inputs: 
     1.1 base-branch from which to check for updates. 
     1.2 head-branch to use to create the PR.
     1.3 GitHub Token for authentication (to create PRs). 
     1.4 Working Dir for which to check for deps. 
    2. exec the npm update command withing the working dir.
    3. Check if there are modified package*.json files.
    4. If there are modified files:
     4.1 Add and commit files to the head branch. 
     4.2 Create a PR to the base-branch using the head-branch using the octokit API
    5. Otherwise, conclude the custom action. 
    */