# Acesso administrativo

1. Mantenha `.env` fora do controle de versão. O `.gitignore` local protege credenciais e PDFs enviados; nunca publique esses arquivos em commits, issues ou mensagens.
2. No primeiro cadastro, defina `ADMIN_USERNAME` e `ADMIN_PASSWORD` no `.env`; use uma senha aleatória longa gerada por um gerenciador de senhas, com no mínimo 15 caracteres. O banco guarda apenas o hash bcrypt.
3. Rode `npm run security:initialize-env` para gerar uma `SESSION_SECRET` nova, criar `TOTP_ENCRYPTION_KEY` se ainda não existir, remover a senha bootstrap e aplicar permissão `0600` ao `.env`. Guarde backup seguro da chave TOTP; perdê-la impede decifrar segredos já armazenados.
4. Para provisionar o MySQL com uma conta exclusiva do portal, enquanto ainda há uma conta de provisionamento com permissão para criar usuários, rode `
`. O comando testa a conexão da conta nova e grava credenciais aleatórias no `.env` sem imprimi-las. Ele concede somente leitura/escrita dos dados e criação/alteração dos objetos do schema `DB_NAME`.
5. Inicie o servidor com `npm run dev` e acesse `http://localhost:3000/tabela.html`.
6. No primeiro login, escaneie o QR code com um aplicativo autenticador e confirme o código de seis dígitos. Nos próximos acessos, senha e código do aplicativo serão exigidos.

## Rotação após exposição

As credenciais que foram coladas em uma conversa devem ser consideradas comprometidas: isso inclui a senha administrativa, a senha do MySQL e a chave de sessão. `npm run security:initialize-env` já renova a chave de sessão. Rode `npm run security:rotate-admin`; a nova senha fica em `.admin-password-reset` (arquivo ignorado pelo Git e modo `0600`), sem aparecer no terminal. Abra esse arquivo localmente, transfira a senha para um gerenciador de senhas e apague o arquivo. O comando invalida todas as sessões existentes. A senha bootstrap `ADMIN_PASSWORD` já foi removida do `.env`. O comando `npm run security:least-privilege-db` provisiona uma conta exclusiva para o portal, mas a senha da conta MySQL administrativa que foi exposta ainda deve ser trocada pelo administrador do MySQL. Se o `.env` foi commitado ou enviado a terceiros, remova-o do repositório/histórico. Faça a rotação da chave `TOTP_ENCRYPTION_KEY` somente com um procedimento que decifre e recifre os segredos existentes; trocá-la diretamente torna esses segredos irrecuperáveis.

## Controles ativos e implantação

- Helmet define cabeçalhos HTTP, CSP, proteção contra framing, MIME sniffing e referrer. CSP ainda permite scripts/estilos inline porque as páginas existentes os utilizam; remover essa permissão requer mover esses blocos para arquivos locais.
- Alterações de estado exigem cabeçalho `Origin` correspondente ao host. Atrás de proxy TLS, configure `TRUST_PROXY=1` somente se o proxy for confiável e não aceitar cabeçalhos de proxy vindos diretamente da internet.
- Cookies `HttpOnly`, `SameSite=Strict` e `Secure` em produção; sessão expira após 30 minutos sem atividade e, no máximo, oito horas. Login tem limite de tentativas por IP em cada processo.
- Use HTTPS em produção, restrinja a conta MySQL aos privilégios mínimos necessários, mantenha backups protegidos e atualize dependências. O limite de tentativas em memória deve ser substituído por armazenamento compartilhado se houver várias instâncias.
- Segredos TOTP são obrigatoriamente cifrados com AES-256-GCM e chave vinculada ao ID do usuário. Segredos anteriores em texto simples são migrados após uma validação TOTP bem-sucedida.
- Uploads aceitam um PDF por requisição, têm limite de 20 MB, nome aleatório e validação da assinatura `%PDF-`; o tipo MIME do navegador não é considerado prova suficiente.
- A aplicação não implementa criptografia pós-quântica própria. Para tráfego resistente a ataques quânticos, implante TLS em proxy/servidor que ofereça troca de chaves híbrida ML-KEM conforme [NIST FIPS 203](https://csrc.nist.gov/pubs/fips/203/final), usando bibliotecas e provedores validados. [FIPS 204 (ML-DSA)](https://csrc.nist.gov/pubs/fips/204/final) e [FIPS 205 (SLH-DSA)](https://csrc.nist.gov/pubs/fips/205/final) são padrões de assinatura e não substituem TLS ou TOTP.
- Os controles abordam riscos do [OWASP Top 10:2025](https://top10.owasp.org/2025/), em especial controle de acesso, configuração, cadeia de suprimentos, falhas criptográficas, autenticação e tratamento de exceções; não representam certificação nem auditoria formal.

As tabelas `usuarios_admin` e `sessoes_admin` são criadas automaticamente no banco já configurado. O cadastro TOTP fica associado ao usuário no MySQL. A listagem pública em `index.html` continua disponível; publicação de documentos, listagem de arquivos locais e `tabela.html` exigem autenticação administrativa.