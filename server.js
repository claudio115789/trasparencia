 

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const MySQLStore = require('express-mysql-session')(session);
const documentoRoutes = require('./routes/documentoRoutes');
const authRoutes = require('./routes/authRoutes');
const authController = require('./controllers/authController');
const documentoController = require('./controllers/documentoController');
const requireSameOrigin = require('./middlewares/requireSameOrigin');

const app = express();
const PORT = process.env.PORT || 3000;
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

const sessionStore = new MySQLStore({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'transparencia_db',
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 8 * 60 * 60 * 1000,
    createDatabaseTable: true,
    schema: { tableName: 'sessoes_admin' }
});

if (!process.env.TOTP_ENCRYPTION_KEY) {
    throw new Error('Configure TOTP_ENCRYPTION_KEY antes de iniciar a aplicação.');
}
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('Configure SESSION_SECRET com pelo menos 32 caracteres em produção.');
}

// Middlewares Globais
app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));
app.use(session({
    name: 'grasa.sid',
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    if (!req.session?.authenticated) return next();

    const idadeSessao = Date.now() - req.session.autenticadoEm;
    if (!Number.isFinite(idadeSessao) || idadeSessao >= 8 * 60 * 60 * 1000) {
        return req.session.destroy(() => {
            res.clearCookie('grasa.sid');
            next();
        });
    }
    next();
});

const limiteAutenticacao = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' }
});

app.use('/api/auth/login', limiteAutenticacao);
app.use('/api/auth/totp', limiteAutenticacao);
app.use('/api/auth', requireSameOrigin);
app.use('/api/auth', authRoutes);

app.get('/tabela.html', (req, res) => {
    if (!req.session?.authenticated) {
        return res.redirect('/login.html?redirect=%2Ftabela.html');
    }
    return res.sendFile(path.join(__dirname, 'public', 'tabela.html'));
});

// Arquivos Estáticos (Front-end e Downloads)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Prefixando as rotas da API
app.use('/api', requireSameOrigin);
app.use('/api', documentoRoutes);

authController.initializeAuth()
    .then(() => documentoController.initializeDocumentSchema())
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });
    })
    .catch(erro => {
        const causa = erro.errors?.find(item => item?.code) || erro.cause || erro;
        console.error('Falha ao inicializar autenticação:', {
            codigo: erro.code || causa.code || null,
            mensagem: erro.message || causa.message || erro.toString()
        });
        process.exit(1);
    });
