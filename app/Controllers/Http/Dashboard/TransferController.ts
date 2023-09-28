import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import { schema, validator } from '@ioc:Adonis/Core/Validator';
import Service from 'App/Models/Service';
import Workspace from 'App/Models/Workspace';
import { v4 as uuidv4 } from 'uuid';

const importSchema = schema.create({
  username: schema.string(),
  lastname: schema.string(),
  mail: schema.string(),
  services: schema.array().anyMembers(),
  workspaces: schema.array().anyMembers(),
});

export default class TransferController {
  /**
   * Display the transfer page
   */
  public async show({ view }: HttpContextContract) {
    return view.render('dashboard/transfer');
  }

  public async import({
    auth,
    request,
    response,
    session,
    view,
  }: HttpContextContract) {
    let file;
    try {
      file = await validator.validate({
        schema: importSchema,
        data: JSON.parse(request.body().file),
      });
    } catch {
      session.flash({
        message: 'Invalid Ferdium account file',
      });

      return response.redirect('/user/transfer');
    }

    if (!file?.services || !file.workspaces) {
      session.flash({
        type: 'danger',
        message: 'Invalid Ferdium account file (2)',
      });
      return response.redirect('/user/transfer');
    }

    const serviceIdTranslation = {};

    // Import services
    try {
      for (const service of file.services) {
        // Get new, unused uuid
        let serviceId;
        do {
          serviceId = uuidv4();
        } while (
          // eslint-disable-next-line no-await-in-loop, unicorn/no-await-expression-member
          (await Service.query().where('serviceId', serviceId)).length > 0
        );

        // eslint-disable-next-line no-await-in-loop
        await Service.create({
          userId: auth.user?.id,
          serviceId,
          name: service.name,
          recipeId: service.recipe_id,
          settings: JSON.stringify(service.settings),
        });

        // @ts-expect-error Element implicitly has an 'any' type because expression of type 'any' can't be used to index type '{}'
        serviceIdTranslation[service.service_id] = serviceId;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
      const errorMessage = `Could not import your services into our system.\nError: ${error}`;
      return view.render('others/message', {
        heading: 'Error while importing',
        text: errorMessage,
      });
    }

    // Import workspaces
    try {
      for (const workspace of file.workspaces) {
        let workspaceId;

        do {
          workspaceId = uuidv4();
        } while (
          // eslint-disable-next-line no-await-in-loop, unicorn/no-await-expression-member
          (await Workspace.query().where('workspaceId', workspaceId)).length > 0
        );

        const services = workspace.services.map(
          // @ts-expect-error Parameter 'service' implicitly has an 'any' type.
          service => serviceIdTranslation[service],
        );

        // eslint-disable-next-line no-await-in-loop
        await Workspace.create({
          userId: auth.user?.id,
          workspaceId,
          name: workspace.name,
          order: workspace.order,
          services: JSON.stringify(services),
          data: JSON.stringify(workspace.data),
        });
      }
    } catch (error) {
      const errorMessage = `Could not import your workspaces into our system.\nError: ${error}`;
      return view.render('others/message', {
        heading: 'Error while importing',
        text: errorMessage,
      });
    }

    return view.render('others/message', {
      heading: 'Successfully imported',
      text: 'Your account has been imported, you can now login as usual!',
    });
  }
}
