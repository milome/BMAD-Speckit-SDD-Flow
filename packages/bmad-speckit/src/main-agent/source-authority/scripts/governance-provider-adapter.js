"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStubGovernanceProviderAdapter = createStubGovernanceProviderAdapter;
exports.createHttpJsonGovernanceProviderAdapter = createHttpJsonGovernanceProviderAdapter;
exports.createOpenAICompatibleGovernanceProviderAdapter = createOpenAICompatibleGovernanceProviderAdapter;
exports.createAnthropicCompatibleGovernanceProviderAdapter = createAnthropicCompatibleGovernanceProviderAdapter;
exports.resolveModelHintsViaGovernanceProvider = resolveModelHintsViaGovernanceProvider;
const model_governance_hint_resolver_1 = require("./model-governance-hint-resolver");
const prompt_routing_governance_1 = require("./prompt-routing-governance");
const skill_inventory_provider_1 = require("./skill-inventory-provider");
function defaultHttpJsonRequestBuilder(input) {
    const resolvedSkillInventory = input.projectRoot &&
        input.hostKind &&
        !(input.availableSkills?.length || input.skillPaths?.length || input.skillInventory?.length)
        ? (0, skill_inventory_provider_1.resolveGovernanceSkillInventory)({
            projectRoot: input.projectRoot,
            hostKind: input.hostKind,
        })
        : null;
    const promptRoutingPreview = (0, prompt_routing_governance_1.resolvePromptHintUsageFromText)({
        projectRoot: input.projectRoot ?? process.cwd(),
        promptText: input.promptText,
        stageContextKnown: input.stageContextKnown,
        gateFailure: {
            exists: input.gateFailureExists,
            blockerOwnershipLocked: input.blockerOwnershipLocked,
        },
        artifactState: {
            rootTargetLocked: input.rootTargetLocked,
            equivalentAdapterCount: input.equivalentAdapterCount,
        },
        availableSkills: input.availableSkills ?? resolvedSkillInventory?.availableSkills,
        skillPaths: input.skillPaths ?? resolvedSkillInventory?.skillPaths,
        skillInventory: input.skillInventory ?? resolvedSkillInventory?.skillInventory,
    });
    return {
        promptText: input.promptText,
        routingContext: {
            stageContextKnown: input.stageContextKnown,
            gateFailureExists: input.gateFailureExists,
            blockerOwnershipLocked: input.blockerOwnershipLocked,
            rootTargetLocked: input.rootTargetLocked,
            equivalentAdapterCount: input.equivalentAdapterCount,
            capabilitySlot: input.capabilitySlot,
            canonicalAgent: input.canonicalAgent,
            actualExecutor: input.actualExecutor,
            targetArtifacts: input.targetArtifacts,
            availableSkills: input.availableSkills ?? resolvedSkillInventory?.availableSkills ?? [],
            skillPaths: input.skillPaths ?? resolvedSkillInventory?.skillPaths ?? [],
            skillInventory: input.skillInventory ?? resolvedSkillInventory?.skillInventory ?? [],
        },
        promptRoutingPreview: {
            executionIntentCandidate: promptRoutingPreview.executionIntentCandidate,
            executionPlanDecision: promptRoutingPreview.executionPlanDecision,
            semanticSkillFeatures: promptRoutingPreview.executionPlanDecision?.semanticSkillFeatures ??
                promptRoutingPreview.executionIntentCandidate?.semanticSkillFeatures ??
                [],
            semanticFeatureTopN: promptRoutingPreview.executionPlanDecision?.semanticFeatureTopN ??
                promptRoutingPreview.executionIntentCandidate?.semanticFeatureTopN ?? {
                stageHints: [],
                actionHints: [],
                interactionHints: [],
                researchPolicyHints: [],
                delegationHints: [],
                constraintHints: [],
            },
        },
    };
}
function normalizeOpenAICompatibleBaseUrl(baseUrl) {
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}
function normalizeAnthropicCompatibleBaseUrl(baseUrl) {
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}
function extractJsonObjectFromText(text) {
    const trimmed = text.trim();
    if (trimmed === '') {
        throw new Error('Empty provider response content');
    }
    try {
        return JSON.parse(trimmed);
    }
    catch {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return JSON.parse(trimmed.slice(start, end + 1));
        }
        throw new Error('Provider response did not contain a valid JSON object');
    }
}
function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === 'string' && item.trim() !== '');
}
function normalizeRecommendationItems(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const record = item;
        const candidateValue = typeof record.value === 'string'
            ? record.value.trim()
            : typeof record.skillId === 'string'
                ? record.skillId.trim()
                : typeof record.role === 'string'
                    ? record.role.trim()
                    : '';
        const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
        const confidence = record.confidence === 'low' ||
            record.confidence === 'medium' ||
            record.confidence === 'high'
            ? record.confidence
            : 'medium';
        if (!candidateValue || !reason) {
            return null;
        }
        return {
            value: candidateValue,
            reason,
            confidence,
        };
    })
        .filter((item) => Boolean(item));
}
function toModelGovernanceHintCandidate(payload, adapterId, protocol) {
    const candidate = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : {};
    const nested = candidate.hint && typeof candidate.hint === 'object' && !Array.isArray(candidate.hint)
        ? candidate.hint
        : candidate.candidate &&
            typeof candidate.candidate === 'object' &&
            !Array.isArray(candidate.candidate)
            ? candidate.candidate
            : candidate;
    const confidence = nested.confidence;
    const researchPolicy = nested.researchPolicy;
    const delegationPreference = nested.delegationPreference;
    const recommendedSkillItems = normalizeRecommendationItems(nested.recommendedSkillItems);
    const recommendedSubagentRoleItems = normalizeRecommendationItems(nested.recommendedSubagentRoleItems);
    const recommendedSkillChain = normalizeStringArray(nested.recommendedSkillChain);
    const recommendedSubagentRoles = normalizeStringArray(nested.recommendedSubagentRoles);
    return {
        source: 'model-provider',
        providerId: adapterId,
        providerMode: protocol,
        confidence: confidence === 'low' || confidence === 'medium' || confidence === 'high' ? confidence : 'low',
        ...(typeof nested.suggestedStage === 'string' ? { suggestedStage: nested.suggestedStage } : {}),
        ...(typeof nested.suggestedAction === 'string'
            ? { suggestedAction: nested.suggestedAction }
            : {}),
        ...(typeof nested.suggestedArtifactTarget === 'string'
            ? { suggestedArtifactTarget: nested.suggestedArtifactTarget }
            : {}),
        explicitRolePreference: normalizeStringArray(nested.explicitRolePreference),
        recommendedSkillChain: recommendedSkillChain.length > 0
            ? recommendedSkillChain
            : recommendedSkillItems.map((item) => item.value),
        recommendedSubagentRoles: recommendedSubagentRoles.length > 0
            ? recommendedSubagentRoles
            : recommendedSubagentRoleItems.map((item) => item.value),
        ...(recommendedSkillItems.length > 0 ? { recommendedSkillItems } : {}),
        ...(recommendedSubagentRoleItems.length > 0 ? { recommendedSubagentRoleItems } : {}),
        researchPolicy: researchPolicy === 'allowed' ||
            researchPolicy === 'forbidden' ||
            researchPolicy === 'preferred'
            ? researchPolicy
            : 'allowed',
        delegationPreference: delegationPreference === 'decide-for-me' || delegationPreference === 'ask-me-first'
            ? delegationPreference
            : 'ask-me-first',
        constraints: normalizeStringArray(nested.constraints),
        rationale: typeof nested.rationale === 'string' && nested.rationale.trim() !== ''
            ? nested.rationale
            : 'Governance provider response',
        overrideAllowed: false,
        ...(nested.forbiddenOverrides &&
            typeof nested.forbiddenOverrides === 'object' &&
            !Array.isArray(nested.forbiddenOverrides)
            ? {
                forbiddenOverrides: nested.forbiddenOverrides,
            }
            : {}),
    };
}
async function postJson(endpoint, body, headers, timeoutMs, method) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(endpoint, {
            method,
            headers: {
                'content-type': 'application/json',
                ...headers,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`Governance provider request failed: ${response.status} ${response.statusText}`);
        }
        return (await response.json());
    }
    finally {
        clearTimeout(timer);
    }
}
function defaultOpenAICompatibleSystemPrompt() {
    return [
        'You are a governance hint synthesizer.',
        'Return JSON only.',
        'The input contains an explicit semanticSkillFeatures field describing skill-derived stage/action/interaction/research/delegation/constraint signals.',
        'Treat semanticSkillFeatures as first-class structured routing evidence, not as incidental prose.',
        'You may suggest stage/action/artifact/role/research/delegation/constraints.',
        'You must not assert authority over blocker ownership, failed-check severity, or artifact-derived root target.',
    ].join(' ');
}
function defaultAnthropicCompatibleSystemPrompt() {
    return [
        'You are a governance hint synthesizer.',
        'Return JSON only.',
        'The input contains an explicit semanticSkillFeatures field describing skill-derived stage/action/interaction/research/delegation/constraint signals.',
        'Treat semanticSkillFeatures as first-class structured routing evidence, not as incidental prose.',
        'You may suggest stage/action/artifact/role/research/delegation/constraints.',
        'You must not assert authority over blocker ownership, failed-check severity, or artifact-derived root target.',
    ].join(' ');
}
function parseOpenAICompatibleResponse(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('OpenAI-compatible provider returned a non-object payload');
    }
    const doc = payload;
    if (typeof doc.output_text === 'string' && doc.output_text.trim() !== '') {
        return extractJsonObjectFromText(doc.output_text);
    }
    const choices = doc.choices;
    if (Array.isArray(choices) && choices.length > 0) {
        const first = choices[0];
        const message = first.message && typeof first.message === 'object'
            ? first.message
            : null;
        const content = message?.content;
        if (typeof content === 'string') {
            return extractJsonObjectFromText(content);
        }
        if (Array.isArray(content)) {
            const text = content
                .map((item) => item &&
                typeof item === 'object' &&
                typeof item.text === 'string'
                ? item.text
                : '')
                .join('\n');
            return extractJsonObjectFromText(text);
        }
    }
    throw new Error('OpenAI-compatible provider response missing choices[0].message.content or output_text');
}
function parseAnthropicCompatibleResponse(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Anthropic-compatible provider returned a non-object payload');
    }
    const doc = payload;
    const content = doc.content;
    if (!Array.isArray(content) || content.length === 0) {
        throw new Error('Anthropic-compatible provider response missing content blocks');
    }
    const text = content
        .map((item) => item && typeof item === 'object' && typeof item.text === 'string'
        ? item.text
        : '')
        .join('\n');
    return extractJsonObjectFromText(text);
}
function createStubGovernanceProviderAdapter(candidate, id = 'stub-governance-provider-adapter') {
    const provider = (0, model_governance_hint_resolver_1.createStubModelGovernanceHintProvider)(candidate, id);
    return {
        id,
        protocol: 'stub',
        displayName: 'Stub Governance Provider Adapter',
        resolveModelHints(input) {
            return provider.resolve(input);
        },
    };
}
function createHttpJsonGovernanceProviderAdapter(config) {
    return {
        id: config.id,
        protocol: 'http-json',
        displayName: config.displayName ?? 'HTTP JSON Governance Provider Adapter',
        async resolveModelHints(input) {
            const response = await postJson(config.endpoint, (config.requestBuilder ?? defaultHttpJsonRequestBuilder)(input), config.headers ?? {}, config.timeoutMs ?? 30_000, config.method ?? 'POST');
            const parsed = config.responseParser ? config.responseParser(response, input) : response;
            return toModelGovernanceHintCandidate(parsed, config.id, 'http-json');
        },
    };
}
function createOpenAICompatibleGovernanceProviderAdapter(config) {
    const endpoint = `${normalizeOpenAICompatibleBaseUrl(config.baseUrl)}/chat/completions`;
    return {
        id: config.id,
        protocol: 'openai-compatible',
        displayName: config.displayName ?? 'OpenAI-Compatible Governance Provider Adapter',
        async resolveModelHints(input) {
            const body = {
                model: config.model,
                temperature: 0,
                response_format: {
                    type: 'json_object',
                },
                messages: [
                    {
                        role: 'system',
                        content: config.systemPrompt ?? defaultOpenAICompatibleSystemPrompt(),
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(defaultHttpJsonRequestBuilder(input)),
                    },
                ],
            };
            const response = await postJson(endpoint, body, {
                ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
                ...(config.headers ?? {}),
            }, config.timeoutMs ?? 30_000, 'POST');
            const parsed = parseOpenAICompatibleResponse(response);
            return toModelGovernanceHintCandidate(parsed, config.id, 'openai-compatible');
        },
    };
}
function createAnthropicCompatibleGovernanceProviderAdapter(config) {
    const endpoint = `${normalizeAnthropicCompatibleBaseUrl(config.baseUrl)}/messages`;
    return {
        id: config.id,
        protocol: 'anthropic-http',
        displayName: config.displayName ?? 'Anthropic-Compatible Governance Provider Adapter',
        async resolveModelHints(input) {
            const body = {
                model: config.model,
                max_tokens: config.maxTokens ?? 512,
                system: config.systemPrompt ?? defaultAnthropicCompatibleSystemPrompt(),
                messages: [
                    {
                        role: 'user',
                        content: JSON.stringify(defaultHttpJsonRequestBuilder(input)),
                    },
                ],
            };
            const response = await postJson(endpoint, body, {
                ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
                'anthropic-version': config.anthropicVersion ?? '2023-06-01',
                ...(config.headers ?? {}),
            }, config.timeoutMs ?? 30_000, 'POST');
            const parsed = parseAnthropicCompatibleResponse(response);
            return toModelGovernanceHintCandidate(parsed, config.id, 'anthropic-http');
        },
    };
}
async function resolveModelHintsViaGovernanceProvider(input, adapter) {
    return (0, model_governance_hint_resolver_1.resolveModelGovernanceHintCandidate)(input, {
        id: adapter.id,
        mode: adapter.protocol,
        resolve: (payload) => adapter.resolveModelHints({ ...input, ...payload }),
    });
}
