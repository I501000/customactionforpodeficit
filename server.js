const xsenv = require('@sap/xsenv')
const bodyParser = require('body-parser');
const serviceBindings = xsenv.getServices({ 
    deficitactionuaa: {tag: 'xsuaa'}
})
const UAA_CREDENTIALS = serviceBindings.deficitactionuaa

const express = require('express')
const app = express();
const xssec = require('@sap/xssec')
const passport = require('passport')
const mail = require('nodemailer')
const {retrieveJwt} = require('@sap-cloud-sdk/core')
const {businessPartnerService} = require('@sap/cloud-sdk-vdm-business-partner-service')
const JWTStrategy = xssec.JWTStrategy
passport.use('JWT', new JWTStrategy(UAA_CREDENTIALS))
app.use(passport.initialize())
app.use(express.text())
app.use(bodyParser.json());

function getSupEmail(req){
    const supId = req.body.dataContext.I_POSITNCONFQTYDEFICIT.SUPPLIER;
    const { businessPartnerApi,businessPartnerAddressApi,addressEmailAddressApi} = businessPartnerService();
   return businessPartnerApi.requestBuilder()
    .getByKey(supId).select(businessPartnerApi.schema.BUSINESS_PARTNER,businessPartnerApi.schema.TO_BUSINESS_PARTNER_ADDRESS
        .select(businessPartnerAddressApi.schema.ADDRESS_ID,businessPartnerAddressApi.schema.TO_EMAIL_ADDRESS.select(addressEmailAddressApi.schema.EMAIL_ADDRESS))).execute({
        destinationName: 'O5P',
        jwt: retrieveJwt(req)
    })

}




app.listen(process.env.PORT,  () => { console.log('===> Server started') })


app.post('/action', passport.authenticate('JWT', {session: false}), (req, res) => {
    const auth = req.authInfo  

    if (! auth.checkScope(UAA_CREDENTIALS.xsappname + '.scopefordeficitaction')) {
        console.log(`===> [/action] ERROR scope for webhook access ('scopefordeficitaction') is missing`)
        res.status(403).end('Forbidden. Authorization for webhook access is missing.')
    }else{

        getSupEmail(req).then(email=>{
            // console.log(email.toBusinessPartnerAddress[0].toEmailAddress[0].emailAddress);
            const transport = mail.createTransport({
                service: 'Outlook365',
                auth:{
                    user: 'zhiwei.liu02@outlook.com',
                    pass: 'Jl654!23'
                }
                });
                const content =  "There are deficit in purchase order item" + req.body.dataContext.I_POSITNCONFQTYDEFICIT.PURCHASINGDOCUMENT + "-" 
                + req.body.dataContext.I_POSITNCONFQTYDEFICIT.PURCHASINGDOCUMENTITEM + ",We Ordered " + req.body.dataContext.I_POSITNCONFQTYDEFICIT.MATERIALNAME + "quantity"
                 + req.body.dataContext.I_POSITNCONFQTYDEFICIT.ORDEREDQUANTITY + " " + req.body.dataContext.I_POSITNCONFQTYDEFICIT.PURCHASEORDERQUANTITYUNIT + ",but you only confirmed  " 
                 +  req.body.dataContext.I_POSITNCONFQTYDEFICIT.CONFIRMEDQUANTITY + ", Would you please check again? ";
                const subject = "deficit in Purchase Order " + req.body.dataContext.I_POSITNCONFQTYDEFICIT.PURCHASINGDOCUMENT + "Item " + req.body.dataContext.I_POSITNCONFQTYDEFICIT.PURCHASINGDOCUMENTITEM;


            const mailoptions = {
                from: "zhiwei.liu02@outlook.com",
                to:  email.toBusinessPartnerAddress[0].toEmailAddress[0].emailAddress ,
                subject: subject,
                text:  content
                };
                   

        transport.sendMail(mailoptions,function(err,info){
            if (err) {
                res.status(501).send(err);
            } else {
                res.status(201).send(info);
            }

        }) ;
                            
        
        })
        .catch(err=>{
            console.log('err:'+err);
            res.status(501).send(err);
        })
    }      
})  