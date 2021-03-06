import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';
import { Targets } from '../../api/targets/targets.js';
import { SavingsAccounts } from '../../api/savingsAccounts/savingsAccounts.js';
import { Transactions } from '../../api/transactions/transactions.js';
import { MomentsJS } from 'meteor/momentjs:moment';
import { Accounting } from 'meteor/lepozepo:accounting';

import '../save/save.js';
import './target.html';
import './edit-target.html';
import './target.css';

Template.Target.onCreated(function targetOnCreated() {
  this.calculation = new ReactiveDict();
  Meteor.subscribe('targets');
  Meteor.subscribe('savingsAccounts');
  Meteor.subscribe('transactions');
});

Template.Target.onRendered(function () {
  setMinDate();
});

Template.EditTarget.onRendered(function () {
  setMinDate();
});

Template.registerHelper('formatMoney', function(amount) {
    return accounting.formatMoney(amount, "£", 0);
});

Template.registerHelper('formatDate', function(date) {
    return moment(date).format("ddd Do MMM YYYY");
});

Template.Target.helpers({
  targets() {
    return Targets.find({});
  },
  targetId() {
    const userId = Meteor.userId();
    const target = Targets.findOne({createdBy: userId});
    var targetId = "";
    if (target) {
      targetId = target._id;
    }
    return targetId;
  },
  targetDate() {
    const userId = Meteor.userId();
    const target = Targets.findOne({createdBy: userId});
    const targetDate = moment(target.targetDate);
    return targetDate;
  },
  dateRangeFrequency() {
    return Session.get('dateOption');
  },
  targetAmount() {
    let dateOption = Session.get('dateOption');
    return calculateTargetAmountByTimeRange(dateOption);
  },
  fullTargetAmount() {
    const userId = Meteor.userId();
    const target = Targets.findOne({createdBy: userId});
    const targetAmount = target.targetAmount;
    return targetAmount;
  },
  stillToSave() {
    const instance = Template.instance();
    return instance.calculation.get('stillToSave');
  },
  targetSummary() {
    const instance = Template.instance();
    return instance.calculation.get('targetSummary');
  },
  dailyTarget() {
    const instance = Template.instance();
    return instance.calculation.get('dailyTarget');
  },
  weeklyTarget() {
    const instance = Template.instance();
    return instance.calculation.get('weeklyTarget');
  },
  monthlyTarget() {
    const instance = Template.instance();
    return instance.calculation.get('monthlyTarget');
  },
  tempTargetDate() {
    const instance = Template.instance();
    return moment(instance.calculation.get('tempTargetDate'));
  },
  tempTargetAmount() {
    const instance = Template.instance();
    return instance.calculation.get('tempTargetAmount');
  },
  targetDateForFormPrepopulation() {
    const userId = Meteor.userId();
    const targetDate = moment(Targets.findOne({createdBy: userId}).targetDate).format('YYYY-MM-D');
    return targetDate;
  },
  currentBalance() {
    if(account()) {
      return currentBalance();
    }
  },
  percentageOfTotal(balance = currentBalance(), target = targetAmount()) {
    let dateOption = Session.get('dateOption');
    let totalTransactions = transactionsValue(dateOption) || currentBalance();
    let percentage = Math.round(totalTransactions / calculateTargetAmountByTimeRange(dateOption) * 100);
    return percentage;
  },
  totalInDegrees() {
    let total = Template.Target.__helpers.get('percentageOfTotal').call();
    let totalInDegrees = ((total * 2.4) - 120).toString() + 'deg';
    return totalInDegrees;
  },
  degreesAbove() {
    let total = Template.Target.__helpers.get('percentageOfTotal').call();
    let degreesAbove = ((total * 2.4) - 120 + 6).toString() + 'deg';
    return degreesAbove;
  },
  degreesBelow() {
    let total = Template.Target.__helpers.get('percentageOfTotal').call();
    let degreesBelow = ((total * 2.4) - 120 - 6).toString() + 'deg';
    return degreesBelow;
  },
  showCalculation() {
    const instance = Template.instance();
    return instance.calculation.get('showCalculation');
  }
});

Template.Target.events({
  'click .calculate'(event, template) {
    event.preventDefault();
    const targetAmount = template.find('.targetAmount').value;
    if (targetAmount > 0) {
      if (noAccount) {
        Meteor.call('savingsAccounts.create');
      }
      let stillToSave = targetAmount - currentBalance();
      let targetDate = new Date(template.find('.targetDate').value);

      let targetDateMoment = moment(targetDate);
      let today = moment(new Date());
      let daysToSave = targetDateMoment.diff(today, 'days');

      let amountPerMonth = Math.round(((stillToSave / daysToSave) * 365) / 12);
      let amountPerWeek = Math.round((stillToSave / daysToSave) * 7);
      let amountPerDay = Math.round(stillToSave / daysToSave);

      template.calculation.set('showCalculation', true);
      template.calculation.set('tempTargetAmount', targetAmount);
      template.calculation.set('stillToSave', stillToSave);
      template.calculation.set('tempTargetDate', targetDate);
      template.calculation.set('monthlyTarget', amountPerMonth);
      template.calculation.set('weeklyTarget', amountPerWeek);
      template.calculation.set('dailyTarget', amountPerDay);
    }
  },
  'change .date-range'(event) {
    event.preventDefault();
    const dateRange = event.target;
    let dateOption = dateRange.value;
    Session.set('dateOption', dateOption);
    let transactionsTotal = transactionsValue(dateOption);
  },
  'click .submit-target'(event, template) {
    event.preventDefault();
    let targetAmount = parseFloat(template.calculation.get('tempTargetAmount'));
    let targetDate = template.calculation.get('tempTargetDate');
    if (noAccount) {
      Meteor.call('savingsAccounts.create');
    }
    Meteor.call('targets.add', targetAmount, targetDate);
    Meteor.call('post.add', "Set a new target of " + accounting.formatMoney(targetAmount, "£", 0)+ " to achieve by " + moment(targetDate).format("ddd Do MMM YYYY"));
    Session.set('addMode', !Session.get('addMode'));
  },
  'click .delete-target'(event) {
    const target = event.target;
    let targetId = target.name;
    Meteor.call('targets.remove', targetId);
    Meteor.call('post.add', "Deleted a target, is this a cry for help?!");
  },
  'click .fa-edit'(event) {
    BlazeLayout.render("mainLayout", {content: 'EditTarget'});
  },
  'click .fa-trash'(event) {
    const target = event.target;
    let targetId = target.id;
    Meteor.call('targets.remove', targetId);
    Meteor.call('post.add', "Deleted a target. Is this a cry for help?!");
    BlazeLayout.render("mainLayout", {content: 'Target'});
  }
});

Template.EditTarget.onCreated(function targetOnCreated() {
  this.calculation = new ReactiveDict();
  Meteor.subscribe('targets');
  Meteor.subscribe('savingsAccounts');
  Meteor.subscribe('transactions');
});

Template.EditTarget.helpers({
  targetDate() {
    const userId = Meteor.userId();
    const target = Targets.findOne({createdBy: userId});
    const targetDate = moment(target.targetDate);
    return targetDate;
  },
  targetAmount() {
    let dateOption = Session.get('dateOption');
    return calculateTargetAmountByTimeRange(dateOption);
  },
  stillToSave() {
    const instance = Template.instance();
    return instance.calculation.get('stillToSave');
  },
  targetSummary() {
    const instance = Template.instance();
    return instance.calculation.get('targetSummary');
  },
  dailyTarget() {
    const instance = Template.instance();
    return instance.calculation.get('dailyTarget');
  },
  weeklyTarget() {
    const instance = Template.instance();
    return instance.calculation.get('weeklyTarget');
  },
  monthlyTarget() {
    const instance = Template.instance();
    return instance.calculation.get('monthlyTarget');
  },
  tempTargetDate() {
    const instance = Template.instance();
    return moment(instance.calculation.get('tempTargetDate'));
  },
  tempTargetAmount() {
    const instance = Template.instance();
    return instance.calculation.get('tempTargetAmount');
  },
  targetDateForFormPrepopulation() {
    const userId = Meteor.userId();
    const targetDate = moment(Targets.findOne({createdBy: userId}).targetDate).format('YYYY-MM-D');
    return targetDate;
  },
  currentBalance() {
    if(account()) {
      return currentBalance();
    }
  },
  showCalculation() {
    const instance = Template.instance();
    return instance.calculation.get('showCalculation');
  }
});

Template.EditTarget.events({
  'click .calculate'(event, template) {
    event.preventDefault();
    const targetAmount = template.find('.targetAmount').value;
    if (targetAmount > 0) {
      if (noAccount) {
        Meteor.call('savingsAccounts.create');
      }

      let stillToSave = targetAmount - currentBalance();
      let targetDate = new Date(template.find('.targetDate').value);

      let targetDateMoment = moment(targetDate);
      let today = moment(new Date());
      let daysToSave = targetDateMoment.diff(today, 'days');

      let amountPerMonth = Math.round(((stillToSave / daysToSave) * 365) / 12);
      let amountPerWeek = Math.round((stillToSave / daysToSave) * 7);
      let amountPerDay = Math.round(stillToSave / daysToSave);

      template.calculation.set('showCalculation', true);
      template.calculation.set('tempTargetAmount', targetAmount);
      template.calculation.set('stillToSave', stillToSave);
      template.calculation.set('tempTargetDate', targetDate);
      template.calculation.set('monthlyTarget', amountPerMonth);
      template.calculation.set('weeklyTarget', amountPerWeek);
      template.calculation.set('dailyTarget', amountPerDay);
    }
  },
  'click .edit-target-button'(event, template) {
    event.preventDefault();
    let targetAmount = parseFloat(template.calculation.get('tempTargetAmount'));
    let targetDate = template.calculation.get('tempTargetDate');
    Meteor.call('targets.edit', targetAmount, targetDate);
    Meteor.call('post.add', "Had a change of heart, now aiming for " + accounting.formatMoney(targetAmount, "£", 0)+ " by " + moment(targetDate).format("ddd Do MMM YYYY"));
    BlazeLayout.render("mainLayout", {content: 'Target'});
  },
});

function setPreviousDate(date,number,period) {
  let startingDate = moment(date);
  let previousDate = startingDate.subtract(number,period);
  return previousDate.toDate();
}

function transactionsInRange(dateOption) {
  let previousDate;
  let currentDate = new Date();
  if (dateOption == "days") {
    previousDate = moment(currentDate).startOf('day').toDate();
  }
  else {
    previousDate = setPreviousDate(currentDate,1,dateOption);
  }
  let transactionsInRange = Transactions.find( {$and: [ {owner: currentUserId()}, {createdAt: {$lt: currentDate, $gte: previousDate} } ] } ).fetch();
  return transactionsInRange;
}

function transactionsValue(dateOption){
  let transactions = transactionsInRange(dateOption);
  let total = 0;
  for (let i = 0; i < transactions.length; i++) {
    total += transactions[i].amount;
  }
  return total;
}

function targetDate() {
  return Targets.findOne({createdBy: currentUserId()}).targetDate;
}

function stillToSave() {
  return targetAmount() - currentBalance();
}

function daysToSave() {
  let today = moment(new Date());
  let targetDateMoment = moment(targetDate());
  return targetDateMoment.diff(today, 'days');
}

function currentBalance() {
  return account().balance;
}

function currentUserId() {
  return Meteor.userId();
}

function targetAmount() {
  return Targets.findOne({createdBy: currentUserId()}).targetAmount;
}

function account() {
  return SavingsAccounts.findOne({createdBy: currentUserId()});
}

function amountPerDay() {
  return Math.round(stillToSave() / daysToSave());
}

function amountPerWeek() {
  if (daysToSave() < 7) {
    return Math.round(stillToSave());
  }
  else {
    return Math.round((stillToSave() / daysToSave()) * 7);
  }
}

function amountPerMonth() {
  if (daysToSave() < 30) {
    return Math.round(stillToSave());
  }
  else {
    return Math.round(((stillToSave() / daysToSave()) * 365) / 12);
  }
}

function calculateTargetAmountByTimeRange(dateOption) {
  if (dateOption == "days") {
    return amountPerDay();
  }
  else if(dateOption == "weeks") {
    return amountPerWeek();
  }
  else if(dateOption == "months") {
    return amountPerMonth();
  }
  else {
    return targetAmount();
  }
}

function setMinDate() {
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth()+1;
  var yyyy = today.getFullYear();
   if(dd<10){
          dd='0'+dd;
      }
      if(mm<10){
          mm='0'+mm;
      }

  today = yyyy+'-'+mm+'-'+dd;
  document.getElementById("target-date").setAttribute("min", today);
}
