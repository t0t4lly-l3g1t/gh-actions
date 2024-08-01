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

const setupLogger = ({debug, prefix} = {debug: false, prefix: ''}) => ({
    debug: (message) => {
        if (debug) {
            core.info(`DEBUG ${prefix}${prefix ? ' : ' : ''}${message}`);
        }
    },
    info: (message) => {
        core.info(`${prefix}${prefix ? ' : ' : ''}${message}`);
    },
    warning: (message) => {
        core.warning(`${prefix}${prefix ? ' : ' : ''}${message}`);
    },
    error: (message) => {
        core.error(`${prefix}${prefix ? ' : ' : ''}${message}`);
    }
});

async function run() {
    const baseBranch = core.getInput('base-branch', { required: true });
    const headBranch = core.getInput('head-branch', { required: true });
    const ghToken = core.getInput('gh-token', { required: true });
    const workingDir = core.getInput('working-directory', { required: true });
    const debug = core.getInput('debug') === 'true';
    const logger = setupLogger({debug, prefix: '[JS-dependency-update]'});
    
    const commonExecOpts = {
        cwd: workingDir
    };
    
    core.setSecret(ghToken);
    logger.debug('Validating Inputs - base-branch, head-branch, working-directory');

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
    
    logger.debug(`base branch is ${baseBranch}`);
    logger.debug(`head branch is ${headBranch}`);
    logger.debug(`working directory is ${workingDir}`);
    
    logger.debug('Checking for package updates');

    try {
        await exec.exec('git fetch origin', [], commonExecOpts);
        await exec.exec(`git checkout -b ${headBranch} origin/${baseBranch}`, [], commonExecOpts);
        await exec.exec('npm update', [], commonExecOpts);
        
        const gitStatus = await exec.getExecOutput('git status -s package*.json', [], commonExecOpts);
        
        if (gitStatus.stdout.length > 0) {
            logger.debug('There are updates available.');

            logger.debug('Setting up git');
            await setupGit();
            logger.debug('Committing package.json changes');

            await exec.exec('git add package.json package-lock.json', [], commonExecOpts);
            await exec.exec('git commit -m "chore: update dependencies"', [], commonExecOpts);
            
            let pushAttempts = 0;
            const maxPushAttempts = 3;
            
            while (pushAttempts < maxPushAttempts) {
                try {
                    await exec.exec(`git push -u origin ${headBranch}`, [], commonExecOpts);
                    logger.info('Successfully pushed changes.');
                    break;
                } catch (error) {
                    pushAttempts++;
                    if (pushAttempts >= maxPushAttempts) {
                        throw error;
                    }
                    logger.warning(`Push attempt ${pushAttempts} failed. Retrying...`);
                    await exec.exec(`git fetch origin ${baseBranch}`, [], commonExecOpts);
                    await exec.exec(`git rebase origin/${baseBranch}`, [], commonExecOpts);
                }
            }

            logger.debug('Fetching Octokit API');
            const octokit = github.getOctokit(ghToken);
            try {
                logger.debug(`Creating PR using head-branch ${headBranch}`);
                await octokit.rest.pulls.create({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    title: 'Update NPM dependencies',
                    body: 'This PR updates NPM packages',
                    base: baseBranch,
                    head: headBranch
                });
                logger.info('Successfully created PR.');
            } catch (e) {
                logger.error('Something went wrong creating the PR. Check logs below.');
                core.setFailed(e.message);
                logger.error(e);
            }
            
        } else {
            logger.info('No updates available at this time.');
        }
    } catch (error) {
        logger.error('An error occurred during the update process:');
        logger.error(error.message);
        core.setFailed(error.message);
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