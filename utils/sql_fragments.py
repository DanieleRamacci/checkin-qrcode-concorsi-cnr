"""SQL fragments shared across bandi/referente queries.

Estratti qui perche' copiati identici in piu' punti (routes/api_v1/bandi.py e
utils/jconon_service.py): una singola fonte evita che una modifica ai
conteggi di assegnazione (es. rename colonna, nuova regola "incompleta")
venga applicata solo in alcuni endpoint lasciando stati incoerenti tra le
viste referente/sede/esperto remoto.
"""

# Richiede che la query includa `sessioni AS s` e `sessione_config AS sc`
# con quegli alias esatti (LEFT o INNER JOIN, GROUP BY per commission_id).
# Il nome sessione e' seguito dalla data quando disponibile per distinguere
# due sessioni omonime dello stesso bando (es. due "Sessione mattina" in
# giorni diversi) nell'elenco delle sessioni incomplete.
SESSION_ASSIGNMENT_COUNTS_SQL = """\
                       COUNT(DISTINCT s.session_id)
                           FILTER (WHERE TRIM(COALESCE(sc.email_esperto_remoto, '')) <> '')
                           AS remote_expert_assigned_count,
                       COUNT(DISTINCT s.session_id)
                           FILTER (WHERE TRIM(COALESCE(sc.email_informatico_sede, '')) <> '')
                           AS sede_technician_assigned_count,
                       ARRAY_REMOVE(
                           ARRAY_AGG(
                               DISTINCT (s.nome || COALESCE(' (' || s.data_esame || ')', ''))
                           )
                           FILTER (
                               WHERE s.session_id IS NOT NULL
                                 AND (
                                     TRIM(COALESCE(sc.email_esperto_remoto, '')) = ''
                                     OR TRIM(COALESCE(sc.email_informatico_sede, '')) = ''
                                 )
                           ),
                           NULL
                       ) AS incomplete_session_names,"""
