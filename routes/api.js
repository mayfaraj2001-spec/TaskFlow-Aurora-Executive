const router=require('express').Router(),c=require('../controllers/crud');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
router.get('/stats',wrap(c.stats));
const report=require('../controllers/reports');
router.get('/reports/summary',wrap(report.summary));
router.get('/reports/excel',wrap(report.excel));
router.get('/reports/slides',wrap(report.slides));
router.get('/:type',wrap(c.list));router.post('/:type',wrap(c.create));router.put('/:type/:id',wrap(c.update));router.delete('/:type/:id',wrap(c.remove));
module.exports=router;
