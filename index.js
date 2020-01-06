#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");

let version = process.argv[2];
if (!version) {
  throw new Error('Missing "version" argument');
}

const hasUncheckedChanges = execSync(`git status -s`, {
  encoding: "utf8"
}).trim();
if (hasUncheckedChanges) {
  throw new Error("Commit your changes first");
}

let currentBranch;
try {
  currentBranch = execSync(`git rev-parse --abbrev-ref HEAD`, {
    encoding: "utf8"
  }).trim();
} catch (error) {
  // if there hasn't been any
  currentBranch = "master";
}

let overwrite = false;
function checkIfWeCanOverwrite(object) {
  if (overwrite || process.argv[2] === "--force" || process.argv[2] === "-f") {
    return true;
  }
  console.log(`The ${object} already exists. Overwrite (y/n)?`);
  const result = execSync(
    `read -p "The ${object} already exists. Overwrite (y/n)? " choice
case "$choice" in
  y|Y ) echo "Overwriting...";;
  n|N ) echo "Cannot overwrite";;
  * ) echo "invalid";;
esac`,
    { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] }
  ).trim();
  console.log(result);
  if (result === "Overwriting...") {
    overwrite = true;
    return true;
  }
  process.exit(1);
}

// check if the local branch already exists
try {
  execSync(`git rev-parse --verify releases/${version}`, { stdio: "ignore" });
  checkIfWeCanOverwrite("local branch");
  console.log(`

-----------------------------------
--     Removing local branch     --
-----------------------------------`);
  execSync(`git branch -D releases/${version}`, {
    encoding: "utf8",
    stdio: "inherit"
  });
} catch (err) {
  // all good
}

// check if the remote branch already exists
try {
  if (
    !execSync(`git ls-remote --heads origin refs/heads/releases/${version}`, {
      encoding: "utf8"
    }).trim()
  ) {
    throw new Error("no remote branch");
  }
  checkIfWeCanOverwrite("remote branch");
  console.log(`

-----------------------------------
--    Removing remote branch     --
-----------------------------------
`);
  execSync(`git push origin --delete releases/${version}`, {
    encoding: "utf8",
    stdio: "inherit"
  });
} catch (err) {
  // all good
}

// check if the tag already exists
try {
  execSync(`git rev-parse --verify ${version}`, { stdio: "ignore" });
  checkIfWeCanOverwrite("tag");
  console.log(`

-----------------------------------
--     Removing existing tag     --
-----------------------------------
`);
  execSync(`git tag -d ${version}`, { encoding: "utf8", stdio: "inherit" });
  execSync(`git push origin :${version}`, {
    encoding: "utf8",
    stdio: "inherit"
  });
} catch (err) {
  // all good
}

console.log(`

-----------------------------------
--      Creating new branch      --
--      Installing, building     --
--        Pruning dev deps       --
-----------------------------------
`);

execSync(
  `git checkout -b releases/${version} && npm install && npm run build && npm prune --production`,
  {
    encoding: "utf8",
    stdio: "inherit"
  }
);

if (fs.existsSync(".gitignore")) {
  console.log(`

-----------------------------------
--      Updating .gitignore      --
-----------------------------------
`);
  const gitignore = fs.readFileSync(".gitignore", { encoding: "utf8" });

  fs.writeFileSync(
    ".gitignore",
    gitignore.replace(
      /# comment out in distribution branches\n((?:(?:.+)\n)*)/g,
      (m, p1) => {
        console.log(`Commented ${p1.trim().split(/\n/g).length} lines`);
        return `# comment out in distribution branches
${p1
  .trim()
  .split(/\n/g)
  .map(x => `# ${x}`)
  .join("\n")}
`;
      }
    )
  );
}

console.log(`

-----------------------------------
--       Pushing everything      --
-----------------------------------
`);

execSync(
  `git add . && git commit -a -m "check in prod dependencies" && git push && git tag ${version} && git push --tags`,
  {
    encoding: "utf8",
    stdio: "inherit"
  }
);

console.log(`

-----------------------------------
--     Going back to previous    --
-----------------------------------
`);

execSync(`git checkout ${currentBranch} && npm install`, {
  encoding: "utf8",
  stdio: "inherit"
});

console.log(`

✅ All done!
`);
