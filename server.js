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

function getSupEmail(situBody,jwtB){
    // const supId = situBody.I_POSITNCONFQTYDEFICIT.SUPPLIER;
    const supId = situBody.SUPPLIER;
    
    console.log(supId);
    const { businessPartnerApi,businessPartnerAddressApi,addressEmailAddressApi} = businessPartnerService();
   return businessPartnerApi.requestBuilder()
    .getByKey(supId).select(businessPartnerApi.schema.BUSINESS_PARTNER,businessPartnerApi.schema.TO_BUSINESS_PARTNER_ADDRESS
        .select(businessPartnerAddressApi.schema.ADDRESS_ID,businessPartnerAddressApi.schema.TO_EMAIL_ADDRESS.select(addressEmailAddressApi.schema.EMAIL_ADDRESS))).execute({
        destinationName: 'situo5p',
        jwt: jwtB
    })

}




app.listen(process.env.PORT,  () => { console.log('===> Server started') })


app.post('/action', passport.authenticate('JWT', {session: false}), (req, res) => {
    const auth = req.authInfo

    if (! auth.checkScope(UAA_CREDENTIALS.xsappname + '.scopefordeficitaction')) {
        console.log(`===> [/action] ERROR scope for webhook access ('scopefordeficitaction') is missing`)
        res.status(403).end('Forbidden. Authorization for webhook access is missing.')
    }else{
        //  console.log(req.body);
        //  console.log(req.body.input.dataContext);
        console.log(req.body);
        console.log(typeof(req.body));

        const situBody = (typeof(req.body)==='object') ? req.body: JSON.parse(req.body);

        //  const situBody = JSON.parse(req.body);

         const jwtB = retrieveJwt(req);

        getSupEmail(situBody,jwtB).then(email=>{
            // console.log(email.toBusinessPartnerAddress[0].toEmailAddress[0].emailAddress);
            const transport = mail.createTransport({
                service: 'Outlook365',
                auth:{
                    user: 'firstname.lastname@outlook.com',
                    pass: 'emailPassword'
                }
                });
                const content =  "There are deficit in purchase order item" + situBody.PURCHASINGDOCUMENT + "-"
                + situBody.PURCHASINGDOCUMENTITEM + ",We Ordered " + situBody.MATERIALNAME + "quantity"
                 + situBody.ORDEREDQUANTITY + " " + situBody.PURCHASEORDERQUANTITYUNIT + ",but you only confirmed  "
                 +  situBody.CONFIRMEDQUANTITY + ", Would you please check again? ";
                const subject = "deficit in Purchase Order " + situBody.PURCHASINGDOCUMENT + "Item " + situBody.PURCHASINGDOCUMENTITEM;
console.log(email.toBusinessPartnerAddress[0].toEmailAddress[0].emailAddress );

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
