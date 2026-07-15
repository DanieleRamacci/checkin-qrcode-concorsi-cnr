from utils.candidati import _external_api_error_message


def test_external_api_error_message_explains_cmis_unauthorized():
    message = _external_api_error_message(
        500,
        '{"exception":"org.apache.chemistry.opencmis.commons.exceptions.CmisUnauthorizedException","message":"Unauthorized"}',
    )

    assert "Selezioni Online non autorizza" in message
    assert "segretario" in message
    assert "abilitato" in message


def test_external_api_error_message_keeps_generic_status_for_other_errors():
    assert _external_api_error_message(500, "Internal Server Error") == "Errore API Selezioni Online: 500"
