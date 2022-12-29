const isInspectorOrigin = (req, res, next) => {
    const origin = req.get('origin');
    console.log(`Origin: ${origin}`);
    if(origin === 'http://localhost:3006' || origin === 'https://darkchii.nl'){
        next();
    }else{
        res.status(403).send('Forbidden');
        return;
    }
}

module.exports = isInspectorOrigin;