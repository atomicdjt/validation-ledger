const fs = require('fs');
let code = fs.readFileSync('src/services/governance.ts', 'utf8');

code = code.replace(/import \{ hashData, RevisionHashPayload \} from '\.\/integrity';/, "import { hashData, buildRevisionHashPayload, hashRevision, RevisionHashPayload } from './integrity';");

// Use a simple replacement for the body
code = code.replace(/const timestamp = Date\.now\(\);[\s\S]*?const revision: Revision = \{[\s\S]*?id: generateId\(\),[\s\S]*?projectId.*?[\s\S]*?entityType.*?[\s\S]*?entityId.*?[\s\S]*?timestamp,[\s\S]*?actor,[\s\S]*?previousState: JSON\.stringify\((.*?)\),[\s\S]*?newState: JSON\.stringify\((.*?)\),[\s\S]*?reason,[\s\S]*?hash,[\s\S]*?previousHash,[\s\S]*?\};/g, (match, prev, next) => {
  // Extract specific entityType, entityId, projectId
  const entityTypeMatch = match.match(/entityType(?::\s*([^,]+)|,)/);
  const entityIdMatch = match.match(/entityId(?::\s*([^,]+)|,)/);
  const projectIdMatch = match.match(/projectId(?::\s*([^,]+)|,)/);
  
  const entityType = entityTypeMatch[1] ? entityTypeMatch[1].trim() : 'entityType';
  const entityId = entityIdMatch[1] ? entityIdMatch[1].trim() : 'entityId';
  const projectId = projectIdMatch[1] ? projectIdMatch[1].trim() : 'projectId';

  return `const timestamp = Date.now();
    const payload = buildRevisionHashPayload(
      ${entityType},
      ${entityId},
      ${projectId},
      timestamp,
      actor,
      ${prev},
      ${next},
      reason,
      previousHash
    );

    const hash = await hashRevision(payload);

    const revision: Revision = {
      id: generateId(),
      projectId: payload.projectId,
      entityType: payload.entityType as Revision['entityType'],
      entityId: payload.entityId,
      timestamp,
      actor,
      previousState: JSON.stringify(payload.previousState),
      newState: JSON.stringify(payload.newState),
      reason,
      hash,
      previousHash,
    };`;
});

fs.writeFileSync('src/services/governance.ts', code);
