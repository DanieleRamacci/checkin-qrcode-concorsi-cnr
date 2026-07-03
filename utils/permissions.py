from utils.roles import ROLE_ADMIN, ROLE_ESPERTO


CAPABILITY_MANAGE_OWNED = "manage_owned_commissions"
CAPABILITY_EXPERT_WORKFLOW = "expert_workflow"
CAPABILITY_ADMIN = "admin"


def capabilities_for_roles(roles: set[str]) -> list[str]:
    capabilities = {CAPABILITY_MANAGE_OWNED}
    if ROLE_ESPERTO in roles or ROLE_ADMIN in roles:
        capabilities.add(CAPABILITY_EXPERT_WORKFLOW)
    if ROLE_ADMIN in roles:
        capabilities.add(CAPABILITY_ADMIN)
    return sorted(capabilities)
